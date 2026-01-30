import { IWorldEntity } from '../types/IWorldEntity.js';

/**
 * 전역 엔티티 관리자.
 * 클라이언트와 서버 모두에서 엔티티를 ID 기반으로 추적하고 관리합니다.
 */
export class WorldEntityManager {
  private entities: Map<string, IWorldEntity> = new Map();

  /**
   * 엔티티 등록
   */
  public register(entity: IWorldEntity): void {
    if (this.entities.has(entity.id)) {
      console.warn(`[WorldEntityManager] Entity with ID ${entity.id} already exists. Overwriting.`);
    }
    this.entities.set(entity.id, entity);
  }

  /**
   * 엔티티 제거
   */
  public unregister(id: string): void {
    this.entities.delete(id);
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
   * 모든 엔티티 제거 및 리소스 해제
   */
  public clear(): void {
    this.entities.forEach((e) => e.dispose());
    this.entities.clear();
  }
}
