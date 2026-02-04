import { Observable, Vector3 } from '@babylonjs/core';
import { IWorldEntity, WorldEntityManager as BaseEntityManager } from '@ante/game-core';
import { INetworkManager } from '../interfaces/INetworkManager';

/**
 * 전역 엔티티 관리자 (클라이언트 확장).
 * Babylon.js 전용 로직(Observable, Hit 처리 등)을 포함합니다.
 */
export class WorldEntityManager extends BaseEntityManager {
  private networkManager: INetworkManager;

  // 알림용 옵저버
  public onEntityAdded = new Observable<IWorldEntity>();
  public onEntityRemoved = new Observable<string>();
  public onEntityHit = new Observable<{ id: string; part: string; damage: number }>();

  constructor(networkManager: INetworkManager) {
    super();
    this.networkManager = networkManager;
  }

  public initialize(): void {
    // We don't bother individual removal because NetworkManager.clearObservers()
    // is called when a session ends, wiping all listeners on its observables.
    this.setupNetworkListeners();
  }

  private setupNetworkListeners(): void {
    // 1. 타겟 피격 동기화
    this.networkManager.onTargetHit.add(
      (data: { targetId: string; damage: number; part: string }): void => {
        this.processHit(data.targetId, data.damage, data.part, undefined, true);
      }
    );

    // 2. 적 피격 동기화
    this.networkManager.onEnemyHit.add((data: { id: string; damage: number }): void => {
      this.processHit(data.id, data.damage, 'body', undefined, true);
    });

    // 3. 타겟 파괴 동기화
    this.networkManager.onTargetDestroy.add((data: { targetId: string }): void => {
      this.removeEntity(data.targetId);
    });

    // 4. 적 파괴 동기화
    this.networkManager.onEnemyDestroyed.add((data: { id: string }): void => {
      this.removeEntity(data.id);
    });

    // 5. 아이템 파괴 동기화
    this.networkManager.onPickupDestroyed.add((data: { id: string }): void => {
      this.removeEntity(data.id);
    });

    // 6. 플레이어 피격 동기화 (WorldEntityManager에서도 처리하여 이펙트 및 상태 일관성 유지)
    this.networkManager.onPlayerHit.add((data) => {
      this.processHit(data.targetId, data.damage, data.part || 'body', undefined, true);
    });
  }

  /** 엔티티 등록 */
  public override register(entity: IWorldEntity): void {
    super.register(entity);
    this.onEntityAdded.notifyObservers(entity);
  }

  /** 엔티티 제거 */
  public override unregister(id: string): void {
    const entity = this.getEntity(id);
    if (entity) {
      if (!entity.isDead) {
        entity.die();
      }

      entity.dispose();
      super.unregister(id);
      this.onEntityRemoved.notifyObservers(id);
    }
  }

  // Backward compatibility alias
  public removeEntity(id: string): void {
    this.unregister(id);
  }

  // Alias for backward compatibility
  public registerEntity(entity: IWorldEntity): void {
    this.register(entity);
  }

  /** 특정 타입의 모든 엔티티 조회 */
  public override getEntitiesByType(...types: string[]): IWorldEntity[] {
    return this.getAllEntities().filter((e) => types.includes(e.type));
  }

  /** 엔티티 피격 처리 (중앙 집중식) */
  public override processHit(
    id: string,
    damage: number,
    part: string = 'body',
    hitPoint?: Vector3,
    isAuthoritative: boolean = false
  ): number {
    const finalDamage = super.processHit(id, damage, part, hitPoint, isAuthoritative);

    if (finalDamage > 0) {
      this.onEntityHit.notifyObservers({ id, part, damage: finalDamage });
    }

    return finalDamage;
  }

  public override clear(): void {
    this.getAllEntities().forEach((e) => e.dispose());
    super.clear();
  }
}
