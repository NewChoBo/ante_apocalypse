import { Scene, Vector3, ShadowGenerator } from '@babylonjs/core';
import { EnemyPawn } from '../pawns/EnemyPawn';
import { PlayerPawn } from '../pawns/PlayerPawn';
import { IGameSystem } from '../types/IGameSystem';
import { NetworkMediator } from '../network/NetworkMediator';
import { EventCode, EnemySpawnData, EnemyDestroyData } from '../network/NetworkProtocol';
import { WorldEntityManager } from './WorldEntityManager';

export interface EnemyState {
  id: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  health: number;
  isDead: boolean;
}

/**
 * 적(Enemy) 실체의 생성 및 AI 업데이트를 담당합니다.
 * 실제 피격 처리는 WorldEntityManager에서 수행됩니다.
 */
export class EnemyManager implements IGameSystem {
  private scene: Scene;
  private shadowGenerator: ShadowGenerator;
  private enemies: Map<string, EnemyPawn> = new Map();
  private networkMediator: NetworkMediator;
  private worldManager: WorldEntityManager;

  constructor(scene: Scene, shadowGenerator: ShadowGenerator) {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
    this.networkMediator = NetworkMediator.getInstance();
    this.worldManager = WorldEntityManager.getInstance();
    this.setupNetworkListeners();
  }

  public initialize(): void {
    // 추가 초기화 로직
    this.networkMediator.sendEvent(EventCode.REQ_INITIAL_STATE, {}, true);
  }

  private setupNetworkListeners(): void {
    this.networkMediator.onEnemyUpdated.add((data) => {
      // All clients (including Master) listen to Server
      const { id, position, rotation, state, isMoving, health } = data;
      this.updateEnemy(id, position, rotation, state, isMoving, health);
    });

    this.networkMediator.onEnemySpawnRequested.add((data) => {
      this.handleSpawnEnemy(data);
    });

    this.networkMediator.onEnemyDestroyRequested.add((data) => {
      this.handleDestroyEnemy(data);
    });
  }

  private handleSpawnEnemy(data: EnemySpawnData): void {
    if (this.enemies.has(data.id)) return;
    const position = new Vector3(data.position.x, data.position.y, data.position.z);
    this.createEnemy(data.id, position);
  }

  private handleDestroyEnemy(data: EnemyDestroyData): void {
    const enemy = this.enemies.get(data.id);
    if (enemy) {
      this.worldManager.removeEntity(data.id);
      enemy.dispose();
      this.enemies.delete(data.id);
    }
  }

  public spawnEnemies(_spawnPoints: number[][], _targetPlayer: PlayerPawn): void {
    // Deprecated: Server handles spawning.
    // This function kept for compatibility if needed, but logic removed.
    console.warn('[EnemyManager] spawnEnemies called, but Server is authoritative.');
  }

  public createEnemy(id: string, position: Vector3, _target?: PlayerPawn): EnemyPawn {
    const enemy = new EnemyPawn(this.scene, position, this.shadowGenerator);
    enemy.id = id;
    this.enemies.set(id, enemy);

    // WorldManager에 등록하여 전역 피격 및 관리가 가능하게 함
    this.worldManager.registerEntity(enemy);

    // AI Logic Removed (Server Handle)

    return enemy;
  }

  public update(_deltaTime: number): void {
    // Local AI Tick Removed.
    // Optimizations: Interpolation could go here if implemented manually.
  }

  public updateEnemy(
    id: string,
    position: { x: number; y: number; z: number },
    rotation?: { x: number; y: number; z: number; w?: number },
    _state?: string,
    isMoving?: boolean,
    health?: number
  ): void {
    const enemy = this.enemies.get(id);
    if (enemy) {
      enemy.updateNetworkState(position, rotation || { x: 0, y: 0, z: 0, w: 1 });
      if (isMoving !== undefined) {
        enemy.isMoving = isMoving;
      }
      if (health !== undefined) {
        enemy.updateHealthBar(health);
      }
    }
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
    // Entities are disposed via worldManager.clear or individual removeEntity calls
    this.enemies.clear();
  }
}
