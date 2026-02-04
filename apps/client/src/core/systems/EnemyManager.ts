import { Scene, Vector3, ShadowGenerator, Observer, UniversalCamera } from '@babylonjs/core';
import { EnemyPawn } from '../EnemyPawn';
import { PlayerPawn } from '../PlayerPawn';
import { INetworkManager } from '../interfaces/INetworkManager';
import { BaseEnemyManager, TickManager } from '@ante/game-core';
import { EventCode } from '@ante/common';
import { WorldEntityManager } from './WorldEntityManager';
import { EnemyState } from '@ante/common';
import type { GameContext } from '../../types/GameContext';

/**
 * 적(Enemy) 실체의 생성 및 AI 업데이트를 담당합니다.
 * 실제 피격 처리는 WorldEntityManager에서 수행됩니다.
 */
export class EnemyManager extends BaseEnemyManager {
  private scene: Scene;
  private shadowGenerator: ShadowGenerator;
  private networkManager: INetworkManager;
  private worldManager: WorldEntityManager;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _enemyUpdateObserver: Observer<any> | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _eventObserver: Observer<any> | null = null;

  constructor(
    scene: Scene,
    shadowGenerator: ShadowGenerator,
    networkManager: INetworkManager,
    worldManager: WorldEntityManager,
    tickManager: TickManager
  ) {
    super(networkManager, tickManager);
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
    this.networkManager = networkManager;
    this.worldManager = worldManager;
    this.setupNetworkListeners();
  }

  private setupNetworkListeners(): void {
    this._enemyUpdateObserver = this.networkManager.onEnemyUpdated.add((data) => {
      this.processEnemyMove(data);
    });

    // onEnemyHit is now handled by WorldEntityManager

    this.networkManager.sendEvent(EventCode.REQ_INITIAL_STATE, {}, true);

    this._eventObserver = this.networkManager.onEvent.add(
      (event: { code: number; data: unknown }): void => {
        if (event.code === EventCode.SPAWN_ENEMY) {
          this.handleSpawnEnemy(event.data as EnemyState);
        } else if (event.code === EventCode.DESTROY_ENEMY) {
          this.handleDestroyEnemy(event.data as { id: string });
        }
      }
    );
  }

  private handleSpawnEnemy(data: EnemyState): void {
    if (this.pawns.has(data.id)) return;
    const position = new Vector3(data.position.x, data.position.y, data.position.z);
    this.createEnemy(data.id, position);
  }

  private handleDestroyEnemy(data: { id: string }): void {
    const enemy = this.pawns.get(data.id);
    if (enemy) {
      this.worldManager.removeEntity(data.id);
    }
  }

  public createEnemy(id: string, position: Vector3, target?: PlayerPawn): EnemyPawn {
    const context: GameContext = {
      scene: this.scene,
      networkManager: this.networkManager,
      worldManager: this.worldManager,
      tickManager: this.tickManager,
      camera: target?.camera as UniversalCamera, // Fallback to provided target's camera
    };

    const enemy = new EnemyPawn(this.scene, position, this.shadowGenerator, context);
    enemy.id = id;
    this.pawns.set(id, enemy);

    // WorldManager에 등록하여 전역 피격 및 관리가 가능하게 함
    this.worldManager.registerEntity(enemy);

    this.onEnemySpawned(id, enemy, target);

    return enemy;
  }

  public update(deltaTime: number): void {
    super.update(deltaTime);

    this.pawns.forEach((pawn, id) => {
      const enemy = pawn as EnemyPawn;
      // 사망 혹은 제거 체크 (Visual only)
      if (enemy.isDead || enemy.mesh.isDisposed()) {
        // 제거 처리
        this.worldManager.removeEntity(id);
        this.pawns.delete(id);
        this.unregisterAI(id);
      }
    });
  }

  public applyEnemyStates(states: EnemyState[]): void {
    states.forEach((state: EnemyState): void => {
      const enemy = this.pawns.get(state.id) as EnemyPawn;
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
    if (this._enemyUpdateObserver) {
      this.networkManager.onEnemyUpdated.remove(this._enemyUpdateObserver);
      this._enemyUpdateObserver = null;
    }
    if (this._eventObserver) {
      this.networkManager.onEvent.remove(this._eventObserver);
      this._eventObserver = null;
    }
    this.pawns.clear();
  }
}
