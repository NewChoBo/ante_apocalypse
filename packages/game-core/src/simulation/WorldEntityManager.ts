import { IWorldEntity } from '../types/IWorldEntity.js';
import { DamageSystem } from '../systems/DamageSystem.js';
import { Logger } from '@ante/common';
import { Vector3 } from '@babylonjs/core';
import { TickManager } from '../systems/TickManager.js';
import { ITickable } from '../types/ITickable.js';

const logger = new Logger('WorldEntityManager');

/**
 * 전역 엔티티 관리자.
 * 클라이언트와 서버 모두에서 엔티티를 ID 기반으로 추적하고 관리합니다.
 */
export class WorldEntityManager {
  private entities: Map<string, IWorldEntity> = new Map();
  private tickManager: TickManager;

  constructor(tickManager: TickManager) {
    this.tickManager = tickManager;
  }

  /**
   * 엔티티 등록
   */
  public register(entity: IWorldEntity): void {
    if (this.entities.has(entity.id)) {
      logger.warn(`Entity with ID ${entity.id} already exists. Overwriting.`);
    }
    this.entities.set(entity.id, entity);

    // Lifecycle Management
    // If entity has activate() method, allow it to handle its own registration (e.g. BasePawn)
    if ('activate' in entity && typeof (entity as any).activate === 'function') {
      (entity as any).activate();
    }
    // Fallback: Auto-register to TickManager if tickable and not handled by activate
    else if ('tick' in entity && typeof (entity as any).tick === 'function') {
      this.tickManager.register(entity as unknown as ITickable);
    }
  }

  /**
   * 엔티티 제거
   */
  public unregister(id: string): void {
    const entity = this.entities.get(id);
    if (entity) {
      // Lifecycle Management
      if ('deactivate' in entity && typeof (entity as any).deactivate === 'function') {
        (entity as any).deactivate();
      }
      // Fallback: Unregister from TickManager if tickable
      else if ('tick' in entity && typeof (entity as any).tick === 'function') {
        this.tickManager.unregister(entity as unknown as ITickable);
      }

      this.entities.delete(id);
    }
  }

  /**
   * ID로 엔티티 조회
   */
  public getEntity(id: string): IWorldEntity | undefined {
    return this.entities.get(id);
  }

  /**
   * 특정 타입의 모든 엔티티 조회
   */
  public getEntitiesByType(type: string): IWorldEntity[] {
    return Array.from(this.entities.values()).filter((e) => e.type === type);
  }

  /**
   * 모든 엔티티 조회
   */
  public getAllEntities(): IWorldEntity[] {
    return Array.from(this.entities.values());
  }

  /**
   * 특정 조건에 맞는 엔티티 찾기
   */
  public findEntity(predicate: (entity: IWorldEntity) => boolean): IWorldEntity | undefined {
    return Array.from(this.entities.values()).find(predicate);
  }

  /**
   * 엔티티 피격 처리 (중앙 집중식 공통 로직)
   * @returns 계산된 최종 데미지
   */
  public processHit(
    id: string,
    damage: number,
    part: string = 'body',
    hitPoint?: Vector3,
    isAuthoritative: boolean = false
  ): number {
    const entity = this.getEntity(id);
    if (!entity || entity.isDead) return 0;

    // 공통 데미지 시스템을 사용하여 계산
    const finalDamage = DamageSystem.calculateDamage(damage, part, entity.damageProfile);

    // 권위가 있는 경우(서버 혹은 수신된 확정 패킷) 실제 데미지 적용
    if (isAuthoritative) {
      entity.takeDamage(finalDamage, 'source', part, hitPoint);
    }

    return finalDamage;
  }

  /**
   * 모든 엔티티 제거 및 리소스 해제
   */
  public clear(): void {
    this.entities.forEach((e) => e.dispose());
    this.entities.clear();
  }
}
