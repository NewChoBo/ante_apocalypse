import { Observable, Vector3 } from '@babylonjs/core';
import { IWorldEntity, WorldEntityManager as BaseEntityManager } from '@ante/game-core';
import { NetworkManager } from './NetworkManager';

/**
 * 전역 엔티티 관리자 (클라이언트 확장).
 * Babylon.js 전용 로직(Observable, Hit 처리 등)을 포함합니다.
 */
export class WorldEntityManager extends BaseEntityManager {
  private static instance: WorldEntityManager;
  private networkManager: NetworkManager;

  // 알림용 옵저버
  public onEntityAdded = new Observable<IWorldEntity>();
  public onEntityRemoved = new Observable<string>();
  public onEntityHit = new Observable<{ id: string; part: string; damage: number }>();

  private constructor() {
    super();
    this.networkManager = NetworkManager.getInstance();
    this.setupNetworkListeners();
  }

  public static getInstance(): WorldEntityManager {
    if (!WorldEntityManager.instance) {
      WorldEntityManager.instance = new WorldEntityManager();
    }
    return WorldEntityManager.instance;
  }

  private setupNetworkListeners(): void {
    // 1. 타겟 피격 동기화
    this.networkManager.onTargetHit.add(
      (data: { targetId: string; damage: number; part: string }): void => {
        this.processHit(data.targetId, data.damage, data.part);
      }
    );

    // 2. 적 피격 동기화
    this.networkManager.onEnemyHit.add((data: { id: string; damage: number }): void => {
      this.processHit(data.id, data.damage, 'body');
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
  public processHit(id: string, damage: number, part: string = 'body', hitPoint?: Vector3): void {
    const entity = this.getEntity(id);
    if (!entity || entity.isDead) return;

    // 데미지 계산 (엔티티의 프로필 활용)
    let finalDamage = damage;
    if (entity.damageProfile) {
      const multiplier =
        entity.damageProfile.multipliers[part] ?? entity.damageProfile.defaultMultiplier;
      finalDamage = damage * multiplier;
    }

    // [수정] 클라이언트는 더 이상 직접 히트를 방송하지 않습니다.
    // 서버가 FIRE 이벤트를 보고 직접 Raycast 판정을 내려 HIT을 방송하기 때문입니다.
    // 여기서는 로컬 피격 연출(VFX, UI)만 수행합니다.
    entity.takeDamage(finalDamage, 'source', part, hitPoint);
    this.onEntityHit.notifyObservers({ id, part, damage: finalDamage });

    // 사망 시 처리
    if (entity.isDead) {
      this.removeEntity(id);
    }
  }

  public override clear(): void {
    this.getAllEntities().forEach((e) => e.dispose());
    super.clear();
  }
}
