import { Vector3 } from '@babylonjs/core';
import { INetworkAuthority } from '../network/INetworkAuthority';
import { EventCode } from '@ante/common';
import { IPickup } from '../types/IPickup';

/**
 * 아이템(Pickup) 스폰 권한 및 방송을 담당하는 베이스 클래스.
 */
export abstract class BasePickupManager {
  protected pickups: Map<string, IPickup> = new Map();

  constructor(protected authority: INetworkAuthority) {}

  public requestSpawnPickup(id: string, type: string, position: Vector3): void {
    if (!this.authority.isMasterClient()) return;

    this.authority.sendEvent(EventCode.SPAWN_PICKUP, {
      id,
      type,
      position: { x: position.x, y: position.y, z: position.z },
    });
  }

  public requestDestroyPickup(id: string): void {
    if (!this.authority.isMasterClient()) return;
    this.authority.sendEvent(EventCode.DESTROY_PICKUP, { id });
  }

  /**
   * 확률적으로 아이템 스폰 여부를 결정 (Master 전용)
   */
  public evaluateRandomDrop(position: Vector3, probability: number = 0.4): void {
    if (!this.authority.isMasterClient()) return;

    if (Math.random() > probability) return;

    const type = Math.random() > 0.5 ? 'health_pack' : 'ammo_box';
    const id = `pickup_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    this.requestSpawnPickup(id, type, position);
  }

  public getPickup(id: string): IPickup | undefined {
    return this.pickups.get(id);
  }

  protected abstract createPickup(id: string, type: string, position: Vector3): IPickup;

  public spawnPickup(position: Vector3, type: string, id: string): void {
    if (this.pickups.has(id)) return;
    const pickup = this.createPickup(id, type, position);
    this.pickups.set(id, pickup);
  }
}
