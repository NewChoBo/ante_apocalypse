import { Scene, Vector3, ShadowGenerator } from '@babylonjs/core';
import { IGameSystem } from '../../types/IGameSystem';
import { NetworkMediator } from './NetworkMediator';
import { RemotePlayerPawn } from '../pawns/RemotePlayerPawn';
import { PlayerPawn } from '../pawns/PlayerPawn';
import { CombatComponent } from '../components/combat/CombatComponent';
import { WorldEntityManager } from '../entities/WorldEntityManager';
import {
  EventCode,
  PlayerData,
  OnStateDeltaPayload,
  OnPlayerRespawnPayload,
} from '../../shared/protocol/NetworkProtocol';
import { gameStateStore, scoreStore, gameTimerStore } from '../store/GameStore';
import { NetworkInterpolation } from './NetworkInterpolation';

export class MultiplayerSystem implements IGameSystem {
  private scene: Scene;
  private localPlayer: PlayerPawn;
  private remotePlayers: Map<string, RemotePlayerPawn> = new Map();
  private networkMediator: NetworkMediator;
  private shadowGenerator: ShadowGenerator;
  private lastUpdateTime = 0;
  private updateInterval = 50; // 20Hz update rate
  private interpolator: NetworkInterpolation;

  constructor(
    scene: Scene,
    localPlayer: PlayerPawn,
    shadowGenerator: ShadowGenerator,
    playerName: string = 'Anonymous'
  ) {
    this.scene = scene;
    this.localPlayer = localPlayer;
    this.shadowGenerator = shadowGenerator;
    this.networkMediator = NetworkMediator.getInstance();
    this.interpolator = new NetworkInterpolation();

    this.setupListeners();
    localStorage.setItem('playerName', playerName);
  }

  public initialize(): void {
    const myId = this.networkMediator.getSocketId();
    if (myId) {
      this.localPlayer.id = myId;
      console.log(`[Multiplayer] Local player ID updated to: ${myId}`);
    }

    const playerName = localStorage.getItem('playerName') || 'Anonymous';
    // Join with initial state
    const combat = this.localPlayer.getComponent(CombatComponent) as CombatComponent;
    const weaponId = combat?.getCurrentWeapon()?.name || 'Pistol';

    this.networkMediator.sendEvent(EventCode.JOIN, {
      position: {
        x: this.localPlayer.mesh.position.x,
        y: this.localPlayer.mesh.position.y,
        z: this.localPlayer.mesh.position.z,
      },
      rotation: {
        x: this.localPlayer.camera.rotation.x,
        y: this.localPlayer.camera.rotation.y,
        z: this.localPlayer.camera.rotation.z,
      },
      weaponId: weaponId,
      name: playerName,
    });
  }

  public applyPlayerStates(states: PlayerData[]): void {
    if (!states) return;
    // This is called from Initial State. We can feed it to interpolator too?
    // Or just spawn missing players.
    console.log(`[Multiplayer] Applying ${states.length} player states from sync`);
    states.forEach((p) => {
      if (p.id !== this.networkMediator.getSocketId()) {
        if (!this.remotePlayers.has(p.id)) {
          this.spawnRemotePlayer(p);
        }
      }
    });
    // Also feed to interpolator to start clean
    this.interpolator.addSnapshot(Date.now(), states);
  }

  private setupListeners(): void {
    this.networkMediator.onPlayerJoined.add((player) => {
      if (player.id !== this.networkMediator.getSocketId()) {
        this.spawnRemotePlayer(player);
      }
    });

    // Old Direct Update Listener - DISABLED in favor of Interpolation
    /*
    this.networkMediator.onPlayerUpdated.add((data) => {
      if (data.id !== this.networkMediator.getSocketId()) {
        // ... (Legacy code)
      }
    });
    */

    // NEW: Listen for Full State Sync (Snapshot)
    this.networkMediator.onStateSync.add((data) => {
      // Feed the snapshot buffer using LOCAL reception time to avoid clock sync issues
      this.interpolator.addSnapshot(Date.now(), data.players);

      // Also ensure players exist (Spawn check)
      data.players.forEach((p) => {
        if (p.id !== this.networkMediator.getSocketId() && !this.remotePlayers.has(p.id)) {
          this.spawnRemotePlayer(p);
        }
      });
    });

    this.networkMediator.onPlayerLeft.add((id) => {
      const remote = this.remotePlayers.get(id);
      if (remote) {
        WorldEntityManager.getInstance().removeEntity(id);
        remote.dispose();
        this.remotePlayers.delete(id);
      }
    });

    // onPlayerHit handles damage sync for both local and remote
    this.networkMediator.onHit.add((data) => {
      // Find the entity that was hit
      const targetId = data.targetId;
      const isLocal = targetId === this.networkMediator.getSocketId();

      if (isLocal) {
        this.localPlayer.updateHealth(data.remainingHealth);
      } else {
        const remote = this.remotePlayers.get(targetId);
        if (remote) {
          remote.updateHealth(data.remainingHealth);
        }
      }
    });

    this.networkMediator.onPlayerDied.add((data) => {
      const targetId = data.playerId;
      const isLocal = targetId === this.networkMediator.getSocketId();

      if (isLocal) {
        if (!this.localPlayer.isDead) this.localPlayer.die();
      } else {
        const remote = this.remotePlayers.get(targetId);
        if (remote && !remote.isDead) {
          remote.die();
        }
      }
    });

    this.networkMediator.onEnemyUpdated.add((_data) => {
      // Enemy specific sync can go here if needed
    });

    // Authoritative State Sync (Delta) - Optional if using Snapshots primarily
    this.networkMediator.onStateDelta.add((delta: OnStateDeltaPayload) => {
      this.applyDeltaUpdate(delta);
    });

    this.networkMediator.onMatchStateSync.add((data) => {
      gameTimerStore.set(data.timeFormatted);
      if (data.state === 'GAME_OVER') {
        gameStateStore.set('GAME_OVER');
      } else if (data.state === 'PLAYING') {
        gameStateStore.set('PLAYING');
      }
    });

    this.networkMediator.onScoreSync.add((data) => {
      if (data.totalScore !== undefined) {
        scoreStore.set(data.totalScore);
      }
    });

    this.networkMediator.onPosCorrection.add((data) => {
      console.warn(`[Multiplayer] Position correction received from server!`);
      this.localPlayer.mesh.position.set(data.position.x, data.position.y, data.position.z);
      if (data.rotation) {
        this.localPlayer.mesh.rotation.y = data.rotation.y;
      }
    });

    // Handle Respawn
    this.networkMediator.onPlayerRespawn.add((data: OnPlayerRespawnPayload) => {
      const position = new Vector3(data.position.x, data.position.y, data.position.z);

      if (data.playerId === this.localPlayer.id) {
        this.localPlayer.respawn(position);
      } else {
        const remote = this.remotePlayers.get(data.playerId);
        if (remote) {
          remote.respawn(position);
        }
      }
    });
  }

  private applyDeltaUpdate(delta: OnStateDeltaPayload) {
    // Delta updates can still be useful for non-movement properties like Health
    delta.changedPlayers.forEach((p) => {
      if (p.id === this.localPlayer.id) {
        if (p.health !== undefined) this.localPlayer.updateHealth(p.health);
        return;
      }

      const remote = this.remotePlayers.get(p.id!);
      if (remote) {
        // Position/Rotation handled by Interpolator now, but if delta provides it, we CAN override
        // But better to trust interpolator for movement.
        if (p.weaponId) remote.updateWeapon(p.weaponId);
        if (p.health !== undefined) remote.updateHealth(p.health);
      }
    });

    // Apply Enemy/Target Deltas (Can be handled by EnemyManager if needed, or here)
    delta.changedEnemies.forEach((e) => {
      this.networkMediator.onEnemyUpdated.notifyObservers(e as any);
    });
  }

  private spawnRemotePlayer(player: PlayerData): void {
    if (this.remotePlayers.has(player.id)) return;

    const name = player.name || 'Anonymous';
    const position = player.position || { x: 0, y: 10, z: 0 }; // Default spawn pos

    console.log(
      `[Multiplayer] Spawning remote player: ${player.id} (${name}) at ${position.x}, ${position.y}, ${position.z}`
    );

    const remote = new RemotePlayerPawn(this.scene, player.id, this.shadowGenerator, name);
    remote.position = new Vector3(position.x, position.y, position.z);
    this.remotePlayers.set(player.id, remote);
    WorldEntityManager.getInstance().registerEntity(remote);
  }

  public update(): void {
    const now = performance.now();

    // 1. Send Local State (Keep 20Hz)
    if (now - this.lastUpdateTime > this.updateInterval) {
      const combat = this.localPlayer.getComponent(CombatComponent) as CombatComponent;
      const weaponId = combat?.getCurrentWeapon()?.name || 'Pistol';

      this.networkMediator.sendEvent(
        EventCode.MOVE,
        {
          position: {
            x: this.localPlayer.mesh.position.x,
            y: this.localPlayer.mesh.position.y,
            z: this.localPlayer.mesh.position.z,
          },
          rotation: {
            x: this.localPlayer.camera.rotation.x,
            y: this.localPlayer.mesh.rotation.y, // Use mesh yaw for synchronization
            z: 0,
          },
          weaponId: weaponId,
        },
        false
      );
      this.lastUpdateTime = now;
    }

    // 2. Apply Interpolation for Remote Players
    // We use server time which is approx Date.now() if synchronized, or just local Date.now() if timestamps match.
    // NetworkInterpolation expects the timestamp used in AddSnapshot.
    // Server usually sends Date.now().
    const renderTime = Date.now();
    const interpolatedStates = this.interpolator.getInterpolatedState(renderTime);

    if (interpolatedStates) {
      interpolatedStates.forEach((state, id) => {
        if (id !== this.localPlayer.id) {
          const remote = this.remotePlayers.get(id);
          if (remote) {
            remote.updateNetworkState(
              state.position || { x: 0, y: 0, z: 0 },
              state.rotation || { x: 0, y: 0, z: 0 }
            );
            if (state.weaponId) remote.updateWeapon(state.weaponId);
          }
        }
      });
    }
  }

  public dispose(): void {
    // Mediator observers are cleared centrally or we could clear specific ones here
    this.remotePlayers.forEach((p) => p.dispose());
    this.remotePlayers.clear();
  }

  public getRemotePlayerStates(): PlayerData[] {
    return Array.from(this.remotePlayers.values()).map((remote) => ({
      id: remote.id,
      name: remote.playerName,
      position: { x: remote.mesh.position.x, y: remote.mesh.position.y, z: remote.mesh.position.z },
      rotation: { x: 0, y: remote.mesh.rotation.y, z: 0 },
      weaponId:
        (remote.getComponent(CombatComponent) as CombatComponent)?.getCurrentWeapon()?.name ||
        'Pistol',
      health: remote.health, // RemotePlayerPawn health is updated via NetworkMediator.onHit
    }));
  }
}
