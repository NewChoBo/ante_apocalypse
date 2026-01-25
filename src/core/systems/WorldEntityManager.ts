import { Observable, Vector3 } from '@babylonjs/core';
import { IWorldEntity } from '../../types/IWorldEntity';
import { NetworkManager } from './NetworkManager';
import { EventCode } from '../network/NetworkProtocol';

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
      this.processHit(data.targetId, data.damage, data.part, false);
    });

    // 2. 적 피격 동기화
    this.networkManager.onEnemyHit.add((data) => {
      this.processHit(data.id, data.damage, 'body', false);
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
      if (!entity.isDead) {
        entity.die();
      }
      entity.dispose();
      this.entities.delete(id);
      this.onEntityRemoved.notifyObservers(id);
      console.log(`[WorldEntityManager] Entity removed: ${id}`);
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
    if (entity.isDead && broadcast) {
      this.broadcastDestroy(entity);
    }
  }

  private broadcastHit(entity: IWorldEntity, damage: number, part: string): void {
    if (entity.type === 'enemy') {
      this.networkManager.sendEvent(EventCode.ENEMY_HIT, { id: entity.id, damage });
    } else if (entity.type === 'remote_player') {
      this.networkManager.hit({ targetId: entity.id, damage });
    } else {
      // General target
      this.networkManager.sendEvent(EventCode.TARGET_HIT, { targetId: entity.id, part, damage });
    }
  }

  private broadcastDestroy(entity: IWorldEntity): void {
    if (entity.type === 'enemy' && this.networkManager.isMasterClient()) {
      this.networkManager.sendEvent(EventCode.DESTROY_ENEMY, { id: entity.id });
    } else if (entity.type.includes('target')) {
      this.networkManager.sendEvent(EventCode.TARGET_DESTROY, { targetId: entity.id });
    }
  }

  public clear(): void {
    this.entities.forEach((e) => e.dispose());
    this.entities.clear();
  }
}
