import { Scene, Vector3, ShadowGenerator, Observer } from '@babylonjs/core';
import { EnemyPawn } from '../EnemyPawn';
import { PlayerPawn } from '../PlayerPawn';
import { NetworkManager } from './NetworkManager';
import { BaseEnemyManager } from '@ante/game-core';
import { EventCode } from '@ante/common';
import { WorldEntityManager } from './WorldEntityManager';
import { EnemyState } from '@ante/common';

/**
 * Handles Enemy entity creation and AI updates.
 * Hit processing is handled by WorldEntityManager.
 */
export class EnemyManager extends BaseEnemyManager {
  private scene: Scene;
  private shadowGenerator: ShadowGenerator;
  private networkManager: NetworkManager;
  private worldManager: WorldEntityManager;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _enemyUpdateObserver: Observer<any> | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _eventObserver: Observer<any> | null = null;

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
    const enemy = new EnemyPawn(this.scene, position, this.shadowGenerator, id);
    this.pawns.set(id, enemy);

    // Register with WorldManager for global hit processing and management
    this.worldManager.registerEntity(enemy);

    this.onEnemySpawned(id, enemy, target);

    return enemy;
  }

  public update(deltaTime: number): void {
    super.update(deltaTime);

    this.pawns.forEach((pawn, id) => {
      const enemy = pawn as EnemyPawn;
      // Check for death or removal (Visual only)
      if (enemy.isDead || enemy.mesh.isDisposed()) {
        // Handle removal
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
