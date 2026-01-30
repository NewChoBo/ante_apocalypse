import { Vector3 } from '@babylonjs/core';
import { INetworkAuthority } from '../network/INetworkAuthority';
import { EventCode } from '@ante/common';
import { AIController } from '../controllers/AIController';
import { IEnemyPawn } from '../types/IEnemyPawn';

/**
 * 적(Enemy)의 생성 및 통제 권한을 관리하는 베이스 시스템.
 * 서버 혹은 마스터 클라이언트에서만 실제 동작이 수행되도록 설계됨.
 */
export abstract class BaseEnemyManager {
  protected lastSyncTime = 0;
  protected syncInterval = 100; // 10Hz sync
  protected aiControllers: Map<string, AIController> = new Map();

  constructor(protected authority: INetworkAuthority) {}

  /**
   * 엔티티 업데이트 주기에 따라 동기화 패킷을 보낼지 결정.
   */
  public shouldSyncEnemies(): boolean {
    if (!this.authority.isMasterClient()) return false;

    const now = performance.now();
    if (now - this.lastSyncTime > this.syncInterval) {
      this.lastSyncTime = now;
      return true;
    }
    return false;
  }

  /**
   * 적 생성 요청 (권한이 있을 때만 실행)
   */
  public spawnEnemiesAt(points: number[][]): void {
    if (!this.authority.isMasterClient()) return;

    points.forEach((point, index) => {
      const id = `enemy_${index}_${Math.random().toString(36).substr(2, 4)}`;
      const position = Vector3.FromArray(point);
      this.requestSpawnEnemy(id, position);
    });
  }

  /**
   * 개별 적 생성 통보 (권한이 있을 때만 실행)
   */
  public requestSpawnEnemy(id: string, position: Vector3): boolean {
    if (!this.authority.isMasterClient()) return false;

    this.authority.sendEvent(EventCode.SPAWN_ENEMY, {
      id,
      position: { x: position.x, y: position.y, z: position.z },
    });
    return true;
  }

  public requestDestroyEnemy(id: string): void {
    if (!this.authority.isMasterClient()) return;
    this.authority.sendEvent(EventCode.DESTROY_ENEMY, { id });
  }

  public syncEnemyMove(id: string, position: Vector3, rotation: Vector3, isMoving: boolean): void {
    if (!this.authority.isMasterClient()) return;

    this.authority.sendEvent(
      EventCode.ENEMY_MOVE,
      {
        id,
        position: { x: position.x, y: position.y, z: position.z },
        rotation: { x: rotation.x, y: rotation.y, z: rotation.z },
        isMoving,
      },
      false
    );
  }
  public update(deltaTime: number): void {
    if (!this.authority.isMasterClient()) return;

    this.aiControllers.forEach((controller) => {
      controller.tick(deltaTime);
    });
  }

  protected registerAI(id: string, pawn: IEnemyPawn, target: { position: Vector3 }): void {
    if (!this.authority.isMasterClient()) return;
    const controller = new AIController(id, pawn, target, this.authority);
    this.aiControllers.set(id, controller);
  }

  protected unregisterAI(id: string): void {
    const controller = this.aiControllers.get(id);
    if (controller) {
      controller.dispose();
      this.aiControllers.delete(id);
    }
  }

  /**
   * 적 생성 직후 호출하여 AI 등록 등의 권한 로직을 수행
   */
  protected onEnemySpawned(id: string, pawn: IEnemyPawn, target?: { position: Vector3 }): void {
    if (!this.authority.isMasterClient()) return;

    if (target) {
      this.registerAI(id, pawn, target);
    }
  }

  /**
   * 네트워크로부터 Enemy 이동 패킷을 수신했을 때 호출.
   * Master/Server가 아닌 경우에만 로컬 상태를 업데이트함.
   */
  public processEnemyMove(data: {
    id: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    isMoving?: boolean;
  }): void {
    // 권한이 있는 경우(Master)는 자신의 시뮬레이션이 우선이므로 무시
    if (this.authority.isMasterClient()) return;

    const enemy = this.getEnemyPawn(data.id);
    if (enemy) {
      if (enemy.position && enemy.position.set) {
        enemy.position.set(data.position.x, data.position.y, data.position.z);
      }
      // Rotation/Movement handling depends on specific Pawn implementation details not in IEnemyPawn yet.
      // But we can cast or extend IEnemyPawn if needed.
      // For now, let's assume IEnemyPawn has position (Vector3).
      // Rotation might need to be added to IEnemyPawn if we want to support it here generically.

      // Let's add rotation validation or casting for now to avoid breaking changes if IEnemyPawn is minimal
      if ((enemy as any).mesh && (enemy as any).mesh.rotation) {
        (enemy as any).mesh.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
      }

      if (data.isMoving !== undefined) {
        // IEnemyPawn doesn't have isMoving setter in interface yet, casting for now
        (enemy as any).isMoving = data.isMoving;
      }
    }
  }

  /**
   * ID로 IEnemyPawn 구현체를 찾는 추상 메서드
   */
  protected abstract getEnemyPawn(id: string): IEnemyPawn | undefined;
}
