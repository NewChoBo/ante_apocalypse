import { Scene, Vector3, ShadowGenerator } from '@babylonjs/core';
import { EnemyPawn } from '../EnemyPawn';
import { AIController } from '../controllers/AIController';
import { PlayerPawn } from '../PlayerPawn';
import { NetworkManager } from './NetworkManager';
import { EventCode } from '../network/NetworkProtocol';
import { WorldEntityManager } from './WorldEntityManager';

/**
 * 적(Enemy) 실체의 생성 및 AI 업데이트를 담당합니다.
 * 실제 피격 처리는 WorldEntityManager에서 수행됩니다.
 */
export class EnemyManager {
  private scene: Scene;
  private shadowGenerator: ShadowGenerator;
  private enemies: Map<string, EnemyPawn> = new Map();
  private controllers: Map<string, AIController> = new Map();
  private networkManager: NetworkManager;
  private worldManager: WorldEntityManager;
  private lastSyncTime = 0;
  private syncInterval = 100; // 10Hz sync

  constructor(scene: Scene, shadowGenerator: ShadowGenerator) {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
    this.networkManager = NetworkManager.getInstance();
    this.worldManager = WorldEntityManager.getInstance();
    this.setupNetworkListeners();
  }

  private setupNetworkListeners(): void {
    this.networkManager.onEnemyUpdated.add((data) => {
      if (!this.networkManager.isMasterClient()) {
        const enemy = this.enemies.get(data.id);
        if (enemy) {
          enemy.position.set(data.position.x, data.position.y, data.position.z);
          enemy.mesh.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
          if (data.isMoving !== undefined) {
            enemy.isMoving = data.isMoving;
          }
        }
      }
    });

    // onEnemyHit is now handled by WorldEntityManager

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
      this.worldManager.removeEntity(data.id);
    }
  }

  public spawnEnemies(spawnPoints: number[][], targetPlayer: PlayerPawn): void {
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
    enemy.id = id;
    this.enemies.set(id, enemy);

    // WorldManager에 등록하여 전역 피격 및 관리가 가능하게 함
    this.worldManager.registerEntity(enemy);

    if (this.networkManager.isMasterClient() || !this.networkManager.getSocketId()) {
      if (target) {
        const controller = new AIController(`ai_${id}`, enemy, target);
        this.controllers.set(id, controller);
      }
    }

    return enemy;
  }

  public update(deltaTime: number): void {
    this.controllers.forEach((c) => c.tick(deltaTime));

    this.enemies.forEach((enemy, id) => {
      // 사망 혹은 제거 체크
      if (enemy.isDead || enemy.mesh.isDisposed()) {
        // Master인 경우 파괴 이벤트 전송 (WorldManager에서 처리할 수도 있지만 여기서 보장)
        if (this.networkManager.isMasterClient()) {
          this.networkManager.sendEvent(EventCode.DESTROY_ENEMY, { id });
        }

        // 제거 처리
        this.worldManager.removeEntity(id);
        this.enemies.delete(id);
        this.controllers.get(id)?.dispose();
        this.controllers.delete(id);
      }
    });

    if (this.networkManager.isMasterClient()) {
      const now = performance.now();
      if (now - this.lastSyncTime > this.syncInterval) {
        this.enemies.forEach((enemy, id) => {
          if (!enemy.isDead && !enemy.mesh.isDisposed()) {
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
                isMoving: enemy.isMoving,
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
        enemy.updateHealthBar(state.health);
        if (state.isDead && !enemy.isDead) {
          this.worldManager.processHit(state.id, 10000, 'body', false);
        }
      } else if (!state.isDead) {
        const pos = new Vector3(state.position.x, state.position.y, state.position.z);
        this.createEnemy(state.id, pos);
      }
    });
  }

  public dispose(): void {
    this.controllers.forEach((c) => c.dispose());
    // Entities are disposed via worldManager.clear or individual removeEntity calls
    this.enemies.clear();
    this.controllers.clear();
  }
}
