import { Scene, Vector3, ShadowGenerator } from '@babylonjs/core';
import { IGameSystem } from '../types/IGameSystem';
import { NetworkMediator } from './NetworkMediator';
import { RemotePlayerPawn } from '../pawns/RemotePlayerPawn';
import { PlayerPawn } from '../pawns/PlayerPawn';
import { CombatComponent } from '../components/combat/CombatComponent';
import { WorldEntityManager } from '../entities/WorldEntityManager';
import { EventCode, PlayerData } from './NetworkProtocol';

export class MultiplayerSystem implements IGameSystem {
  private scene: Scene;
  private localPlayer: PlayerPawn;
  private remotePlayers: Map<string, RemotePlayerPawn> = new Map();
  private networkMediator: NetworkMediator;
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
    this.networkMediator = NetworkMediator.getInstance();

    this.setupListeners();
    localStorage.setItem('playerName', playerName);
  }

  public initialize(): void {
    const playerName = localStorage.getItem('playerName') || 'Anonymous';
    // Join with initial state
    const combat = this.localPlayer.getComponent(CombatComponent);
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

  public applyPlayerStates(states: any[]): void {
    console.log(`[Multiplayer] Applying ${states.length} player states from sync`);
    states.forEach((p) => {
      if (p.id !== this.networkMediator.getSocketId()) {
        const remote = this.remotePlayers.get(p.id);
        if (remote) {
          remote.updateNetworkState(p.position, p.rotation);
          if (p.weaponId) remote.updateWeapon(p.weaponId);
        } else {
          this.spawnRemotePlayer(p);
        }
      }
    });
  }

  private setupListeners(): void {
    this.networkMediator.onPlayerJoined.add((player) => {
      if (player.id !== this.networkMediator.getSocketId()) {
        this.spawnRemotePlayer(player);
      }
    });

    this.networkMediator.onPlayerUpdated.add((data) => {
      if (data.id !== this.networkMediator.getSocketId()) {
        const remote = this.remotePlayers.get(data.id);
        if (remote) {
          // Apply default values if position or rotation are missing
          const position = data.position || { x: 0, y: 0, z: 0 };
          const rotation = data.rotation || { x: 0, y: 0, z: 0, w: 1 };
          remote.updateNetworkState(position, rotation);
          if (data.weaponId) {
            remote.updateWeapon(data.weaponId);
          }
        }
      }
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
    this.networkMediator.onEnemyUpdated.add((_data) => {
      // Enemy specific sync can go here if needed
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
    if (now - this.lastUpdateTime > this.updateInterval) {
      const combat = this.localPlayer.getComponent(CombatComponent);
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
  }

  public dispose(): void {
    // Mediator observers are cleared centrally or we could clear specific ones here
    this.remotePlayers.forEach((p) => p.dispose());
    this.remotePlayers.clear();
  }
}
