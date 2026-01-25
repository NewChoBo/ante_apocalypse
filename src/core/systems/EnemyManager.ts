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

    this.networkManager.onEvent.add((event) => {
      if (event.code === EventCode.SPAWN_ENEMY) {
        this.handleSpawnEnemy(event.data);
      } else if (event.code === EventCode.DESTROY_ENEMY) {
        this.handleDestroyEnemy(event.data);
      }
    });
  }

  private handleSpawnEnemy(data: any): void {
    if (this.enemies.has(data.id)) return;
    const position = new Vector3(data.position.x, data.position.y, data.position.z);
    this.createEnemy(data.id, position);
  }

  private handleDestroyEnemy(data: any): void {
    const enemy = this.enemies.get(data.id);
    if (enemy) {
      enemy.takeDamage(10000); // Force kill
    }
  }

  public spawnEnemies(spawnPoints: number[][], targetPlayer: PlayerPawn): void {
    // If we are master, we spawn and manage.
    // If not master, should we spawn?
    // If we use authoritative spawning, non-master should NOT spawn from level data,
    // but wait for INITIAL_STATE or SPAWN_ENEMY events.
    // However, for simplicity in "Level Loading", deterministic spawn is okay IF we sync IDs.
    // But to fully support "Master Spawn Authority", let's let Master spawn and others wait.

    if (this.networkManager.isMasterClient() || !this.networkManager.getSocketId()) {
      spawnPoints.forEach((point, index) => {
        const id = `enemy_${index}`;
        const position = Vector3.FromArray(point);
        this.createEnemy(id, position, targetPlayer);
      });
    }
  }

  public createEnemy(id: string, position: Vector3, target?: PlayerPawn): EnemyPawn {
    const enemy = new EnemyPawn(this.scene, position, this.shadowGenerator);
    this.enemies.set(id, enemy);

    // AI Controller only if Master
    if (this.networkManager.isMasterClient() || !this.networkManager.getSocketId()) {
      if (target) {
        const controller = new AIController(`ai_${id}`, enemy, target);
        this.controllers.set(id, controller);
      }
    }

    // Hook into death to broadcast
    // We need a way to know when it dies.
    // Polling isDead in update or existing listener?
    // EnemyPawn doesn't have onDeath observable yet.
    // Let's rely on update loop checking isDead for now,
    // as we already do for broadcasting moves.

    return enemy;
  }

  public update(deltaTime: number): void {
    // 1. Tick local controllers (only for Master)
    this.controllers.forEach((c) => c.tick(deltaTime));

    // 2. Broadcast positions if Master
    if (this.networkManager.isMasterClient()) {
      const now = performance.now();

      // Clean up dead enemies and broadcast destroy
      this.enemies.forEach((enemy, id) => {
        if (enemy.isDead && !enemy.isDisposed()) {
          this.networkManager.sendEvent(EventCode.DESTROY_ENEMY, { id });
          enemy.dispose();
          this.enemies.delete(id);
          this.controllers.get(id)?.dispose();
          this.controllers.delete(id);
        }
      });

      if (now - this.lastSyncTime > this.syncInterval) {
        this.enemies.forEach((enemy, id) => {
          if (!enemy.isDead) {
            // Only sync alive enemies
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
        enemy.updateHealthBar(state.health); // Sync health visual
        if (state.isDead && !enemy.isDead) {
          enemy.takeDamage(1000); // Kill it
        }
      } else {
        // Late joiner or sync missed spawn? Create it.
        if (!enemy && !state.isDead) {
          const pos = new Vector3(state.position.x, state.position.y, state.position.z);
          this.createEnemy(state.id, pos);
          // Update health immediately
          const newEnemy = this.enemies.get(state.id);
          if (newEnemy) newEnemy.updateHealthBar(state.health);
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
