import { Scene, Vector3, ShadowGenerator } from '@babylonjs/core';
import { NetworkManager } from './NetworkManager';
import { PlayerState } from '@ante/common';
import { RemotePlayerPawn } from '../RemotePlayerPawn';
import { PlayerPawn } from '../PlayerPawn';
import { CombatComponent } from '../components/CombatComponent';
import { WorldEntityManager } from './WorldEntityManager';
import { playerHealthStore } from '../store/GameStore';

export class MultiplayerSystem {
  private scene: Scene;
  private localPlayer: PlayerPawn;
  private remotePlayers: Map<string, RemotePlayerPawn> = new Map();
  private networkManager: NetworkManager;
  private shadowGenerator: ShadowGenerator;
  private lastUpdateTime = 0;
  private updateInterval = 50; // 20Hz update rate

  constructor(
    scene: Scene,
    localPlayer: PlayerPawn,
    shadowGenerator: ShadowGenerator,
    playerName: string = 'Anonymous'
  ) {
    this.scene = scene;
    this.localPlayer = localPlayer;
    this.shadowGenerator = shadowGenerator;
    this.networkManager = NetworkManager.getInstance();

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
      if (p.id !== this.networkManager.getSocketId()) {
        const remote = this.remotePlayers.get(p.id);
        if (remote) {
          remote.updateNetworkState(p.position, p.rotation);
          if (p.weaponId) remote.updateWeapon(p.weaponId);
          if (p.health !== undefined) remote.updateHealth(p.health);
        } else {
          this.spawnRemotePlayer(p);
        }
      } else {
        // [Authoritative Local Player Health Sync]
        if (p.health !== undefined && p.health !== this.localPlayer.health) {
          this.localPlayer.health = p.health;
          playerHealthStore.set(p.health);
          if (p.health <= 0 && !this.localPlayer.isDead) {
            this.localPlayer.die();
          }
        }
      }
    });
  }

  private setupListeners(): void {
    this.networkManager.onPlayersList.add((players) => {
      players.forEach((p) => {
        if (p.id !== this.networkManager.getSocketId()) {
          this.spawnRemotePlayer(p);
        }
      });
    });

    this.networkManager.onInitialStateReceived.add((data) => {
      this.applyPlayerStates(data.players);
    });

    this.networkManager.onPlayerJoined.add((player) => {
      if (player.id !== this.networkManager.getSocketId()) {
        this.spawnRemotePlayer(player);
      }
    });

    this.networkManager.onPlayerUpdated.add((player) => {
      const remote = this.remotePlayers.get(player.id);
      if (remote) {
        remote.updateNetworkState(player.position, player.rotation);
        if (player.weaponId) {
          remote.updateWeapon(player.weaponId);
        }
      }
    });

    this.networkManager.onPlayerLeft.add((id) => {
      const remote = this.remotePlayers.get(id);
      if (remote) {
        WorldEntityManager.getInstance().removeEntity(id);
        remote.dispose();
        this.remotePlayers.delete(id);
      }
    });

    this.networkManager.onPlayerHit.add((data) => {
      // 서버로부터 받은 '확정된 체력(newHealth)'을 우선적으로 사용
      if (data.playerId === this.networkManager.getSocketId()) {
        // Local player update
        this.localPlayer.health = data.newHealth;
        playerHealthStore.set(data.newHealth);
        if (data.newHealth <= 0) this.localPlayer.die();
      } else {
        const remote = this.remotePlayers.get(data.playerId);
        if (remote) {
          remote.updateHealth(data.newHealth);
        }
      }
    });

    this.networkManager.onPlayerDied.add((data) => {
      if (data.playerId === this.networkManager.getSocketId()) {
        this.localPlayer.die();
      } else {
        const remote = this.remotePlayers.get(data.playerId);
        if (remote) {
          remote.die();
        }
      }
    });
  }

  private spawnRemotePlayer(player: PlayerState): void {
    if (this.remotePlayers.has(player.id)) return;

    const name = player.name || 'Anonymous';
    console.log(
      `[Multiplayer] Spawning remote player: ${player.id} (${name}) at ${player.position.x}, ${player.position.y}, ${player.position.z}`
    );

    const remote = new RemotePlayerPawn(this.scene, player.id, this.shadowGenerator, name);
    remote.position = new Vector3(player.position.x, player.position.y, player.position.z);
    this.remotePlayers.set(player.id, remote);
    WorldEntityManager.getInstance().registerEntity(remote);
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
    this.networkManager.clearObservers();
    this.remotePlayers.forEach((p) => p.dispose());
    this.remotePlayers.clear();
  }
}
