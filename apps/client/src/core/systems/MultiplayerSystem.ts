import { Scene, Vector3, ShadowGenerator } from '@babylonjs/core';
import { PlayerState } from '@ante/common';
import { RemotePlayerPawn } from '../RemotePlayerPawn';
import { PlayerPawn } from '../PlayerPawn';
import { CombatComponent } from '../components/combat/CombatComponent';
import { WorldEntityManager } from './WorldEntityManager';
import { playerHealthStore, gameStateStore } from '../store/GameStore';
import { INetworkManager } from '../interfaces/INetworkManager';
import { TickManager } from '@ante/game-core';
import { Logger } from '@ante/common';
import type { GameContext } from '../../types/GameContext';
import { normalizePlayerId, isSamePlayerId } from '../network/identity';

const logger = new Logger('MultiplayerSystem');

export class MultiplayerSystem {
  private scene: Scene;
  private localPlayer: PlayerPawn;
  private remotePlayers: Map<string, RemotePlayerPawn> = new Map();
  private networkManager: INetworkManager;
  private worldManager: WorldEntityManager;
  private tickManager: TickManager;
  private shadowGenerator: ShadowGenerator;
  private lastUpdateTime = 0;
  private updateInterval = 8; // ~128Hz update rate (extremely responsive)

  constructor(
    scene: Scene,
    localPlayer: PlayerPawn,
    shadowGenerator: ShadowGenerator,
    networkManager: INetworkManager,
    worldManager: WorldEntityManager,
    tickManager: TickManager,
    playerName: string = 'Anonymous'
  ) {
    this.scene = scene;
    this.localPlayer = localPlayer;
    this.shadowGenerator = shadowGenerator;
    this.networkManager = networkManager;
    this.worldManager = worldManager;
    this.tickManager = tickManager;

    this.setupListeners();
    localStorage.setItem('playerName', playerName);

    // Join with initial state
    const combat = this.localPlayer.getComponent(CombatComponent);
    const weaponId = combat?.getCurrentWeapon()?.name || 'Pistol';

    this.networkManager.join({
      position: this.localPlayer.mesh.position,
      rotation: this.localPlayer.camera.rotation,
      weaponId: weaponId,
      name: playerName,
    });
  }

  public applyPlayerStates(states: PlayerState[]): void {
    states.forEach((p) => {
      const playerId = normalizePlayerId(p.id);
      const localId = normalizePlayerId(this.networkManager.getSocketId());

      if (!isSamePlayerId(playerId, localId)) {
        const remote = this.remotePlayers.get(playerId);
        if (remote) {
          remote.updateNetworkState(p.position, p.rotation);
          if (p.weaponId) remote.updateWeapon(p.weaponId);
          if (p.health !== undefined) remote.updateHealth(p.health);

          // Sync Death State
          if (p.isDead === true && !remote.isDead) remote.die();
          if (p.isDead === false && remote.isDead) {
            const pos = new Vector3(p.position.x, p.position.y, p.position.z);
            remote.respawn(pos);
          }
        } else {
          this.spawnRemotePlayer(p);
        }
      } else {
        // [Authoritative Local Player Health Sync]
        // We rely on EventCode.HIT for immediate damage feedback.
        // We only use the state broadcast as a fallback for significant desyncs (> 2 HP).
        if (p.health !== undefined) {
          const healthDiff = Math.abs(p.health - this.localPlayer.health);
          if (healthDiff > 2) {
            this.localPlayer.health = p.health;
            playerHealthStore.set(p.health);
          }

          // [Death Sync]
          // If server says we are dead, ensure we die locally
          if ((p.isDead === true || p.health <= 0) && !this.localPlayer.isDead) {
            this.localPlayer.die();
          }

          // [Respawn Sync]
          // If server says we are alive (and healthy), ensure we respawn locally
          if (p.isDead === false && p.health > 0 && this.localPlayer.isDead) {
            logger.info('State Sync forced Respawn for Local Player');
            const pos = new Vector3(p.position.x, p.position.y, p.position.z);
            this.localPlayer.respawn(pos);
            gameStateStore.set('PLAYING');
          }
        }
      }
    });
  }

  private setupListeners(): void {
    this.networkManager.onPlayersList.add((players: PlayerState[]): void => {
      players.forEach((p: PlayerState): void => {
        if (!isSamePlayerId(p.id, this.networkManager.getSocketId())) {
          this.spawnRemotePlayer(p);
        }
      });
    });

    this.networkManager.onInitialStateReceived.add((data: { players: PlayerState[] }): void => {
      // logger.info(
      //   `MultiplayerSystem: Received INITIAL_STATE with ${data.players.length} players. My ID: ${this.networkManager.getSocketId()}`
      // );
      this.applyPlayerStates(data.players);
    });

    this.networkManager.onPlayerJoined.add((player: PlayerState): void => {
      if (!isSamePlayerId(player.id, this.networkManager.getSocketId())) {
        this.spawnRemotePlayer(player);
      }
    });

    this.networkManager.onPlayerUpdated.add((player: PlayerState): void => {
      const remote = this.remotePlayers.get(normalizePlayerId(player.id));
      if (remote) {
        remote.updateNetworkState(player.position, player.rotation);
        if (player.weaponId) {
          remote.updateWeapon(player.weaponId);
        }
      }
    });

    this.networkManager.onPlayerLeft.add((id: string): void => {
      const normalizedId = normalizePlayerId(id);
      const remote = this.remotePlayers.get(normalizedId);
      if (remote) {
        this.worldManager.unregister(normalizedId);
        this.remotePlayers.delete(normalizedId);
      }
    });

    this.networkManager.onPlayerFired.add((data: import('@ante/common').FireEventData): void => {
      if (isSamePlayerId(data.playerId, this.networkManager.getSocketId())) return;

      const remote = this.remotePlayers.get(normalizePlayerId(data.playerId));
      if (remote) {
        remote.fire(data.weaponId, data.muzzleTransform);
      }
    });

    this.networkManager.onPlayerReloaded.add(
      (data: { playerId: string; weaponId: string }): void => {
        if (isSamePlayerId(data.playerId, this.networkManager.getSocketId())) return;

        const remote = this.remotePlayers.get(normalizePlayerId(data.playerId));
        if (remote) {
          // If the remote player has a reload method (e.g. for animation), call it
          if (
            'reload' in remote &&
            typeof (remote as unknown as { reload: (id: string) => void }).reload === 'function'
          ) {
            (remote as unknown as { reload: (id: string) => void }).reload(data.weaponId);
          }
        }
      }
    );

    this.networkManager.onPlayerHit.add((data: import('@ante/common').HitEventData): void => {
      // 서버로부터 받은 '확정된 체력(newHealth)'을 우선적으로 사용
      if (data.targetId === this.networkManager.getSocketId()) {
        // Local player update
        this.localPlayer.health = data.newHealth;
        playerHealthStore.set(data.newHealth);
        if (data.newHealth <= 0) this.localPlayer.die();
      } else {
        const remote = this.remotePlayers.get(data.targetId);
        if (remote) {
          remote.updateHealth(data.newHealth);
        }
      }
    });

    this.networkManager.onPlayerDied.add((data: import('@ante/common').DeathEventData): void => {
      if (data.targetId === this.networkManager.getSocketId()) {
        this.localPlayer.die();
      } else {
        const remote = this.remotePlayers.get(data.targetId);
        if (remote) {
          remote.die();
        }
      }
    });

    this.networkManager.onPlayerRespawn.add(
      (data: import('@ante/common').RespawnEventData): void => {
        const pos = new Vector3(data.position.x, data.position.y, data.position.z);

        if (data.playerId === this.networkManager.getSocketId()) {
          // Local player respawn
          this.localPlayer.respawn(pos);
          gameStateStore.set('PLAYING');
        } else {
          // Remote player respawn
          const remote = this.remotePlayers.get(data.playerId);
          if (remote) {
            remote.respawn(pos);
          }
        }
      }
    );
  }

  public getRemotePlayers(): RemotePlayerPawn[] {
    return Array.from(this.remotePlayers.values());
  }

  private spawnRemotePlayer(player: PlayerState): void {
    const playerId = normalizePlayerId(player.id);
    if (this.remotePlayers.has(playerId)) return;
    if (isSamePlayerId(playerId, this.networkManager.getSocketId())) return;

    const name = player.name || 'Anonymous';
    const context: GameContext = {
      scene: this.scene,
      camera: this.localPlayer.camera,
      networkManager: this.networkManager,
      worldManager: this.worldManager,
      tickManager: this.tickManager,
    };

    const remote = new RemotePlayerPawn(this.scene, playerId, this.shadowGenerator, context, name);
    remote.position = new Vector3(player.position.x, player.position.y, player.position.z);
    this.remotePlayers.set(playerId, remote);
    this.worldManager.register(remote);
  }

  public update(): void {
    const now = performance.now();
    if (now - this.lastUpdateTime > this.updateInterval) {
      const combat = this.localPlayer.getComponent(CombatComponent);
      const weaponId = combat?.getCurrentWeapon()?.name || 'Pistol';

      this.networkManager.updateState({
        position: this.localPlayer.mesh.position,
        rotation: new Vector3(
          this.localPlayer.camera.rotation.x,
          this.localPlayer.mesh.rotation.y, // Use mesh yaw for synchronization
          0
        ),
        weaponId: weaponId,
      });
      this.lastUpdateTime = now;
    }
  }

  public dispose(): void {
    this.networkManager.clearObservers('session');
    this.remotePlayers.forEach((p) => p.dispose());
    this.remotePlayers.clear();
  }
}

