import { Scene, Vector3, ShadowGenerator } from '@babylonjs/core';
import { EnemyPawn } from '../EnemyPawn';
import { PlayerPawn } from '../PlayerPawn';
import { NetworkManager } from './NetworkManager';
import { BaseEnemyManager } from '@ante/game-core';
import { EventCode } from '@ante/common';
import { WorldEntityManager } from './WorldEntityManager';
import { EnemyState } from '@ante/common';

/**
 * 적(Enemy) 실체의 생성 및 AI 업데이트를 담당합니다.
 * 실제 피격 처리는 WorldEntityManager에서 수행됩니다.
 */
export class EnemyManager extends BaseEnemyManager {
  private scene: Scene;
  private shadowGenerator: ShadowGenerator;
  private enemies: Map<string, EnemyPawn> = new Map();
  private networkManager: NetworkManager;
  private worldManager: WorldEntityManager;

  constructor(scene: Scene, shadowGenerator: ShadowGenerator) {
    const netManager = NetworkManager.getInstance();
    super(netManager);
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
    this.networkManager = netManager;
    this.worldManager = WorldEntityManager.getInstance();
    this.setupNetworkListeners();
  }

  private setupNetworkListeners(): void {
    this.networkManager.onEnemyUpdated.add((data) => {
      this.processEnemyMove(data);
    });

    // onEnemyHit is now handled by WorldEntityManager

    this.networkManager.sendEvent(EventCode.REQ_INITIAL_STATE, {}, true);

    this.networkManager.onEvent.add((event: { code: number; data: unknown }): void => {
      if (event.code === EventCode.SPAWN_ENEMY) {
        this.handleSpawnEnemy(event.data as EnemyState);
      } else if (event.code === EventCode.DESTROY_ENEMY) {
        this.handleDestroyEnemy(event.data as { id: string });
      }
    });
  }

  private handleSpawnEnemy(data: EnemyState): void {
    if (this.enemies.has(data.id)) return;
    const position = new Vector3(data.position.x, data.position.y, data.position.z);
    this.createEnemy(data.id, position);
  }

  private handleDestroyEnemy(data: { id: string }): void {
    const enemy = this.enemies.get(data.id);
    if (enemy) {
      this.worldManager.removeEntity(data.id);
    }
  }

  public createEnemy(id: string, position: Vector3, target?: PlayerPawn): EnemyPawn {
    const enemy = new EnemyPawn(this.scene, position, this.shadowGenerator);
    enemy.id = id;
    this.enemies.set(id, enemy);

    // WorldManager에 등록하여 전역 피격 및 관리가 가능하게 함
    this.worldManager.registerEntity(enemy);

    this.onEnemySpawned(id, enemy, target);

    return enemy;
  }

  public update(deltaTime: number): void {
    super.update(deltaTime);

    this.enemies.forEach((enemy, id) => {
      // 사망 혹은 제거 체크 (Visual only)
      if (enemy.isDead || enemy.mesh.isDisposed()) {
        // 제거 처리
        this.worldManager.removeEntity(id);
        this.enemies.delete(id);
        this.unregisterAI(id);
      }
    });
  }

  public getEnemyStates(): EnemyState[] {
    const states: EnemyState[] = [];
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

  public applyEnemyStates(states: EnemyState[]): void {
    states.forEach((state: EnemyState): void => {
      const enemy = this.enemies.get(state.id);
      if (enemy) {
        enemy.position.set(state.position.x, state.position.y, state.position.z);
        enemy.mesh.rotation.set(state.rotation.x, state.rotation.y, state.rotation.z);
        enemy.updateHealthBar(state.health);
        if (state.isDead && !enemy.isDead) {
          this.worldManager.processHit(state.id, 10000, 'body');
        }
      } else if (!state.isDead) {
        const pos = new Vector3(state.position.x, state.position.y, state.position.z);
        this.createEnemy(state.id, pos);
      }
    });
  }

  public dispose(): void {
    this.enemies.clear();
  }

  protected getEnemyPawn(id: string): EnemyPawn | undefined {
    return this.enemies.get(id);
  }
}
