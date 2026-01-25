import { Scene, Vector3, ShadowGenerator } from '@babylonjs/core';
import { EnemyPawn } from '../EnemyPawn';
import { AIController } from '../controllers/AIController';
import { PlayerPawn } from '../PlayerPawn';
import { NetworkManager } from './NetworkManager';
import { EventCode } from '../network/NetworkProtocol';

export class EnemyManager {
  private scene: Scene;
  private shadowGenerator: ShadowGenerator;
  private enemies: Map<string, EnemyPawn> = new Map();
  private controllers: Map<string, AIController> = new Map();
  private networkManager: NetworkManager;
  private lastSyncTime = 0;
  private syncInterval = 100; // 10Hz sync

  constructor(scene: Scene, shadowGenerator: ShadowGenerator) {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
    this.networkManager = NetworkManager.getInstance();
    this.setupNetworkListeners();
  }

  private setupNetworkListeners(): void {
    this.networkManager.onEnemyUpdated.add((data) => {
      if (!this.networkManager.isMasterClient()) {
        const enemy = this.enemies.get(data.id);
        if (enemy) {
          enemy.position.set(data.position.x, data.position.y, data.position.z);
          enemy.mesh.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
        }
      }
    });

    this.networkManager.onEnemyHit.add((data) => {
      const enemy = this.enemies.get(data.id);
      if (enemy) {
        enemy.takeDamage(data.damage);
      }
    });

    this.networkManager.sendEvent(EventCode.REQ_INITIAL_STATE, {}, true);
  }

  public spawnEnemies(spawnPoints: number[][], targetPlayer: PlayerPawn): void {
    spawnPoints.forEach((point, index) => {
      const id = `enemy_${index}`;
      const position = Vector3.FromArray(point);
      const enemy = new EnemyPawn(this.scene, position, this.shadowGenerator);
      this.enemies.set(id, enemy);

      // Only master client possess AI controllers
      if (this.networkManager.isMasterClient() || !this.networkManager.getSocketId()) {
        const controller = new AIController(`enemy_ai_${index}`, enemy, targetPlayer);
        this.controllers.set(id, controller);
      }
    });
  }

  public update(deltaTime: number): void {
    // 1. Tick local controllers (only for Master)
    this.controllers.forEach((c) => c.tick(deltaTime));

    // 2. Broadcast positions if Master
    if (this.networkManager.isMasterClient()) {
      const now = performance.now();
      if (now - this.lastSyncTime > this.syncInterval) {
        this.enemies.forEach((enemy, id) => {
          if (!enemy.isDead) {
            this.networkManager.sendEvent(
              EventCode.ENEMY_MOVE,
              {
                id,
                position: { x: enemy.position.x, y: enemy.position.y, z: enemy.position.z },
                rotation: {
                  x: enemy.mesh.rotation.x,
                  y: enemy.mesh.rotation.y,
                  z: enemy.mesh.rotation.z,
                },
              },
              false
            );
          }
        });
        this.lastSyncTime = now;
      }
    }
  }

  public getEnemyStates(): any[] {
    const states: any[] = [];
    this.enemies.forEach((enemy, id) => {
      states.push({
        id,
        position: { x: enemy.position.x, y: enemy.position.y, z: enemy.position.z },
        rotation: {
          x: enemy.mesh.rotation.x,
          y: enemy.mesh.rotation.y,
          z: enemy.mesh.rotation.z,
        },
        health: enemy.health,
        isDead: enemy.isDead,
      });
    });
    return states;
  }

  public applyEnemyStates(states: any[]): void {
    states.forEach((state) => {
      const enemy = this.enemies.get(state.id);
      if (enemy) {
        enemy.position.set(state.position.x, state.position.y, state.position.z);
        enemy.mesh.rotation.set(state.rotation.x, state.rotation.y, state.rotation.z);
        if (state.isDead && !enemy.isDead) {
          enemy.takeDamage(1000); // Kill it
        }
      }
    });
  }

  public dispose(): void {
    this.controllers.forEach((c) => c.dispose());
    this.enemies.forEach((e) => e.dispose());
    this.enemies.clear();
    this.controllers.clear();
  }
}
