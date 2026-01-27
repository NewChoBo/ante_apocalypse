import { Observable, Vector3 } from '@babylonjs/core';
import { IWorldEntity } from '../../types/IWorldEntity';
import { IGameSystem } from '../types/IGameSystem';
import { NetworkMediator } from '../network/NetworkMediator';
import { EventCode, OnDiedPayload } from '../network/NetworkProtocol';

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

    // 2. 타켓 파괴 동기화
    this.networkMediator.onTargetDestroyed.add((data) => {
      this.removeEntity(data.id || data.targetId || '');
    });

    // 3. Hit Detection (Server-Authoritative)
    // Client: Handle Confirmed Hits (Sync HP/Death)
    this.networkMediator.onHit.add((data) => {
      this.applyConfirmedHit(data.targetId, data.damage, data.remainingHealth);
    });

    // 4. Death Detection (Sync Death)
    this.networkMediator.onPlayerDied.add((data) => {
      // Player death is handled in MultiplayerSystem/SessionController
      // But if an enemy died, it might be broadcasted as ON_DIED too
      const entity = this.entities.get(data.playerId);
      if (entity && entity.type === 'enemy') {
        this.removeEntity(data.playerId);
      }
    });

    // Note: REQ_HIT is handled primarily by ServerGameController.
    // ServerGameController broadcasts ON_HIT.
    // WorldEntityManager responds to ON_HIT on all clients (including Master).
  }

  // Client/Local Logic
  private applyConfirmedHit(targetId: string, damage: number, remainingHealth: number): void {
    const entity = this.entities.get(targetId);
    if (!entity) return;

    // 1. Apply visual/sound feedback
    // We call takeDamage but with a flag or just update HP
    // IWorldEntity.updateHealth is preferred for authority correction
    if (remainingHealth >= 0) {
      entity.updateHealth(remainingHealth);
    } else {
      // Blind sync: just subtract damage if HP not known
      entity.takeDamage(damage, 'remote', 'body');
    }

    this.onEntityHit.notifyObservers({ id: targetId, part: 'body', damage: damage });
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

    // [REQ/ON Pattern]
    // If broadcast is true, it means this call originated from some local interaction (e.g. Raycast)
    if (broadcast) {
      // Send REQ_HIT to Server.
      this.networkMediator.sendEvent(EventCode.REQ_HIT, {
        targetId: id,
        damage: damage,
        hitPosition: hitPoint
          ? { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z }
          : { x: 0, y: 0, z: 0 },
      });
      // Do not apply logic locally. Wait for ON_HIT.
      return;
    }

    // This part is called when broadcast=false (from applyConfirmedHit)
    // or when in Single Player (where mediator is null/stubbed?)
    let finalDamage = damage;
    if (entity.damageProfile) {
      const multiplier =
        entity.damageProfile.multipliers[part] ?? entity.damageProfile.defaultMultiplier;
      finalDamage = damage * multiplier;
    }

    entity.takeDamage(finalDamage, 'source', part, hitPoint);
    this.onEntityHit.notifyObservers({ id, part, damage: finalDamage });

    // Master Client specific cleanup
    if (this.networkMediator.isMasterClient() && entity.isDead) {
      this.broadcastDestroy(entity);
      this.removeEntity(id);
    }
  }

  private broadcastDestroy(entity: IWorldEntity): void {
    if (entity.type === 'enemy') {
      const onDied = new OnDiedPayload(entity.id, undefined, 'Shot');
      this.networkMediator.sendEvent(EventCode.ON_DIED, onDied, true);
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
