import { Observable, Vector3 } from '@babylonjs/core';
import { IWorldEntity } from '../../types/IWorldEntity';
import { IGameSystem } from '../types/IGameSystem';
import { NetworkMediator } from './NetworkMediator';
import { EventCode } from '../network/NetworkProtocol';

/**
 * 전역 엔티티 관리자.
 * 적, 타겟, 타 플레이어 등 모든 '피격 및 동기화 가능한' 엔티티를 관리합니다.
 */
export class WorldEntityManager implements IGameSystem {
  private static instance: WorldEntityManager;
  private entities: Map<string, IWorldEntity> = new Map();
  private networkMediator: NetworkMediator;

  // 알림용 옵저버
  public onEntityAdded = new Observable<IWorldEntity>();
  public onEntityRemoved = new Observable<string>();
  public onEntityHit = new Observable<{ id: string; part: string; damage: number }>();

  private constructor() {
    this.networkMediator = NetworkMediator.getInstance();
    this.setupNetworkListeners();
  }

  public initialize(): void {
    // 추가 초기화 로직이 필요할 경우 여기에 구현
  }

  public static getInstance(): WorldEntityManager {
    if (!WorldEntityManager.instance) {
      WorldEntityManager.instance = new WorldEntityManager();
    }
    return WorldEntityManager.instance;
  }

  private setupNetworkListeners(): void {
    // 1. 엔티티 상태 동기화 (NetworkMediator 사용)
    this.networkMediator.onPlayerUpdated.add((_data) => {
      // 필요 시 처리
    });

    // 2. 타겟 파괴 동기화
    this.networkMediator.onTargetDestroyed.add((data) => {
      this.removeEntity(data.id || data.targetId || '');
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
  public processHit(
    id: string,
    damage: number,
    part: string = 'body',
    broadcast: boolean = true,
    hitPoint?: Vector3
  ): void {
    const entity = this.entities.get(id);
    if (!entity || entity.isDead) return;

    // 데미지 계산 (엔티티의 프로필 활용)
    let finalDamage = damage;
    if (entity.damageProfile) {
      const multiplier =
        entity.damageProfile.multipliers[part] ?? entity.damageProfile.defaultMultiplier;
      finalDamage = damage * multiplier;
    }

    entity.takeDamage(finalDamage, 'source', part, hitPoint);
    this.onEntityHit.notifyObservers({ id, part, damage: finalDamage });

    if (broadcast) {
      this.broadcastHit(entity, finalDamage, part);
    }

    // 사망 시 처리
    if (entity.isDead) {
      console.log(`[WorldEntityManager] Entity is dead after hit: ${id}, broadcast: ${broadcast}`);
      if (broadcast || (entity.type === 'enemy' && this.networkMediator.isMasterClient())) {
        this.broadcastDestroy(entity);
      }
      this.removeEntity(id);
    }
  }

  private broadcastHit(entity: IWorldEntity, damage: number, part: string): void {
    if (entity.type === 'enemy') {
      this.networkMediator.sendEvent(EventCode.ENEMY_HIT, { id: entity.id, damage });
    } else if (entity.type === 'remote_player') {
      this.networkMediator.sendEvent(EventCode.HIT, { targetId: entity.id, damage });
    } else {
      // General target (StaticTarget, MovingTarget, HumanoidTarget)
      this.networkMediator.sendEvent(EventCode.TARGET_HIT, { targetId: entity.id, part, damage });
    }
  }

  private broadcastDestroy(entity: IWorldEntity): void {
    if (entity.type === 'enemy' && this.networkMediator.isMasterClient()) {
      this.networkMediator.sendEvent(EventCode.DESTROY_ENEMY, { id: entity.id });
    } else if (entity.type.includes('target')) {
      this.networkMediator.sendEvent(EventCode.TARGET_DESTROY, { targetId: entity.id });
    }
  }

  public dispose(): void {
    this.clear();
  }

  public clear(): void {
    this.entities.forEach((e) => e.dispose());
    this.entities.clear();
  }
}
