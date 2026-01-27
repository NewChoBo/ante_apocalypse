import { Observable, Vector3 } from '@babylonjs/core';
import { IWorldEntity } from '../../types/IWorldEntity';
import { IGameSystem } from '../types/IGameSystem';
import { NetworkMediator } from '../network/NetworkMediator';
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

    // 3. Hit Detection (Server-Authoritative)
    // Master: Handle Incoming Hit Requests
    this.networkMediator.onHitRequested.add((data) => {
      if (this.networkMediator.isMasterClient()) {
        this.handleHitRequest(data);
      }
    });

    // Client: Handle Confirmed Hits (Sync HP/Death)
    this.networkMediator.onHitConfirmed.add((data) => {
      this.applyConfirmedHit(data.targetId, data.damage, data.remainingHealth);
    });
  }

  // Master Logic
  private handleHitRequest(data: {
    targetId: string;
    damage: number;
    shooterId: string;
    hitPosition: { x: number; y: number; z: number };
  }): void {
    const entity = this.entities.get(data.targetId);
    if (!entity || entity.isDead) return;

    // Validation logic here (e.g. check distance, line of sight)
    // For now, accept valid entity hit.

    this.processHit(
      data.targetId,
      data.damage,
      'body',
      true,
      new Vector3(data.hitPosition.x, data.hitPosition.y, data.hitPosition.z)
    );
  }

  // Client/Local Logic
  private applyConfirmedHit(targetId: string, damage: number, remainingHealth: number): void {
    const entity = this.entities.get(targetId);
    if (!entity) return;

    // 1. Apply damage locally for feedback (FX, Sound, standard logic)
    // false = do not broadcast again
    this.processHit(targetId, damage, 'body', false);

    // 2. Force update health/state to match server (Authoritative Correction)
    if (remainingHealth >= 0) {
      // Ideally we cast to a type that supports health setting or use IWorldEntity if we add setHealth
      // For now, check if it has updateHealth method (RemotePlayerPawn)
      if ('updateHealth' in entity && typeof (entity as any).updateHealth === 'function') {
        (entity as any).updateHealth(remainingHealth);
      } else {
        entity.health = remainingHealth;
      }
    }
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

    // 1. If Broadcast is requested (Origin: Local Player)
    //    Perform Server-Auth Check
    if (broadcast) {
      if (this.networkMediator.getSocketId() && !this.networkMediator.isMasterClient()) {
        // I am a Client. Send Request.
        this.networkMediator.sendEvent(EventCode.REQ_HIT, {
          targetId: id,
          damage: damage,
          hitPosition: hitPoint
            ? { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z }
            : { x: 0, y: 0, z: 0 },
        });
        // Do NOT apply damage locally yet (wait for confirmation)
        // Or apply Cosmetic Only?
        // Existing BaseWeapon already does visual Hit Effect via GameObservables.hitEffect
        // So here we strictly control Logic (HP reduction).
        return;
      }
    }

    // 2. Execution (Master or Single Player or Confirmed Local Apply)
    // 데미지 계산 (엔티티의 프로필 활용)
    let finalDamage = damage;
    if (entity.damageProfile) {
      const multiplier =
        entity.damageProfile.multipliers[part] ?? entity.damageProfile.defaultMultiplier;
      finalDamage = damage * multiplier;
    }

    entity.takeDamage(finalDamage, 'source', part, hitPoint);
    this.onEntityHit.notifyObservers({ id, part, damage: finalDamage });

    // 3. If Master, Broadcast Confirmation (Sync)
    if (
      broadcast &&
      (this.networkMediator.isMasterClient() || !this.networkMediator.getSocketId())
    ) {
      // Single Player or Master
      if (this.networkMediator.isMasterClient()) {
        // Broadcast 'CONFIRM_HIT' to sync everyone
        // Note: We currently don't track HP in EntityManager centrally, so we just send damage.
        this.networkMediator.sendEvent(EventCode.CONFIRM_HIT, {
          targetId: id,
          damage: finalDamage,
          remainingHealth: -1, // Todo: Get actual health if available
        });
      }
    }

    // 사망 시 처리
    if (entity.isDead) {
      // Local state check
      if (this.networkMediator.isMasterClient() || !this.networkMediator.getSocketId()) {
        this.broadcastDestroy(entity);
      }
      this.removeEntity(id);
    }
  }

  private broadcastDestroy(entity: IWorldEntity): void {
    if (entity.type === 'enemy' && this.networkMediator.isMasterClient()) {
      this.networkMediator.sendEvent(EventCode.DESTROY_ENEMY, { id: entity.id });
    } else if (entity.type.includes('target')) {
      this.networkMediator.sendEvent(EventCode.TARGET_DESTROY, {
        id: entity.id,
        targetId: entity.id,
      });
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
