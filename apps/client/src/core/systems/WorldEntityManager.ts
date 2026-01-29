import { Observable, Vector3 } from '@babylonjs/core';
import { IWorldEntity } from '../../types/IWorldEntity';
import { NetworkManager } from './NetworkManager';
import { EventCode } from '@ante/common';

/**
 * 전역 엔티티 관리자.
 * 적, 타겟, 타 플레이어 등 모든 '피격 및 동기화 가능한' 엔티티를 관리합니다.
 */
export class WorldEntityManager {
  private static instance: WorldEntityManager;
  private entities: Map<string, IWorldEntity> = new Map();
  private networkManager: NetworkManager;

  // 알림용 옵저버
  public onEntityAdded = new Observable<IWorldEntity>();
  public onEntityRemoved = new Observable<string>();
  public onEntityHit = new Observable<{ id: string; part: string; damage: number }>();

  private constructor() {
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
    this.networkManager.onTargetHit.add((data) => {
      this.processHit(data.targetId, data.damage, data.part);
    });

    // 2. 적 피격 동기화
    this.networkManager.onEnemyHit.add((data) => {
      this.processHit(data.id, data.damage, 'body');
    });

    // 3. 엔티티 파괴 동기화
    this.networkManager.onEvent.add((event) => {
      if (event.code === EventCode.TARGET_DESTROY || event.code === EventCode.DESTROY_ENEMY) {
        const id = event.data.targetId || event.data.id;
        this.removeEntity(id);
      }
    });
  }

  /** 엔티티 등록 */
  public registerEntity(entity: IWorldEntity): void {
    if (this.entities.has(entity.id)) {
      console.warn(`[WorldEntityManager] Entity with ID ${entity.id} already exists. Overwriting.`);
    }
    this.entities.set(entity.id, entity);
    this.onEntityAdded.notifyObservers(entity);
  }

  /** 엔티티 제거 */
  public removeEntity(id: string): void {
    const entity = this.entities.get(id);
    if (entity) {
      console.log(
        `[WorldEntityManager] Attempting to remove entity: ${id}, isDead: ${entity.isDead}`
      );
      if (!entity.isDead) {
        entity.die();
      }

      // 엔티티 타입에 따라 즉시 삭제할지, 연출을 기다릴지 결정할 수 있지만
      // 안전을 위해 일단 내부 맵에서 제거하고 dispose를 호출합니다.
      // (타겟 등의 애니메이션이 끊길 수 있으므로 나중에 개선 여지가 있음)
      entity.dispose();
      this.entities.delete(id);
      this.onEntityRemoved.notifyObservers(id);
      console.log(`[WorldEntityManager] Entity successfully removed: ${id}`);
    } else {
      console.warn(`[WorldEntityManager] Tried to remove non-existent entity: ${id}`);
    }
  }

  /** 엔티티 조회 */
  public getEntity(id: string): IWorldEntity | undefined {
    return this.entities.get(id);
  }

  /** 모든 엔티티 반환 */
  public getAllEntities(): IWorldEntity[] {
    return Array.from(this.entities.values());
  }

  /** 특정 타입의 모든 엔티티 조회 */
  public getEntitiesByType(...types: string[]): IWorldEntity[] {
    return Array.from(this.entities.values()).filter((e) => types.includes(e.type));
  }

  /** 엔티티 피격 처리 (중앙 집중식) */
  public processHit(id: string, damage: number, part: string = 'body', hitPoint?: Vector3): void {
    const entity = this.entities.get(id);
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

  public clear(): void {
    this.entities.forEach((e) => e.dispose());
    this.entities.clear();
  }
}
