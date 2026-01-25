import { Scene, Vector3, ShadowGenerator } from '@babylonjs/core';
import { NetworkManager, PlayerState } from './NetworkManager';
import { RemotePlayerPawn } from '../RemotePlayerPawn';
import { PlayerPawn } from '../PlayerPawn';
import { CombatComponent } from '../components/CombatComponent';

export class MultiplayerSystem {
  private scene: Scene;
  private localPlayer: PlayerPawn;
  private remotePlayers: Map<string, RemotePlayerPawn> = new Map();
  private networkManager: NetworkManager;
  private shadowGenerator: any; // Type as ShadowGenerator if imported
  private lastUpdateTime = 0;
  private updateInterval = 50; // 20Hz update rate

  constructor(scene: Scene, localPlayer: PlayerPawn, shadowGenerator: any) {
    this.scene = scene;
    this.localPlayer = localPlayer;
    this.shadowGenerator = shadowGenerator;
    this.networkManager = NetworkManager.getInstance();

    this.setupListeners();
    const playerNameInput = document.getElementById('player-name-input') as HTMLInputElement;
    const playerName = playerNameInput?.value || 'Player_' + Math.floor(Math.random() * 1000);
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

  private setupListeners(): void {
    this.networkManager.onPlayersList.add((players) => {
      players.forEach((p) => {
        if (p.id !== this.networkManager.getSocketId()) {
          this.spawnRemotePlayer(p);
        }
      });
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
      }
    });

    this.networkManager.onPlayerLeft.add((id) => {
      const remote = this.remotePlayers.get(id);
      if (remote) {
        remote.dispose();
        this.remotePlayers.delete(id);
      }
    });

    this.networkManager.onPlayerHit.add((data) => {
      if (data.playerId === this.networkManager.getSocketId()) {
        // Local player hit
        this.localPlayer.takeDamage(data.damage);
      } else {
        const remote = this.remotePlayers.get(data.playerId);
        if (remote) {
          remote.takeDamage(data.damage);
        }
      }
    });
  }

  private spawnRemotePlayer(player: PlayerState): void {
    if (this.remotePlayers.has(player.id)) return;

    const name = player.name || 'Anonymous';
    console.log(`[Multiplayer] Spawning remote player: ${player.id} (${name})`);

    const remote = new RemotePlayerPawn(this.scene, player.id, this.shadowGenerator, name);
    remote.position = new Vector3(player.position.x, player.position.y, player.position.z);
    this.remotePlayers.set(player.id, remote);
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
