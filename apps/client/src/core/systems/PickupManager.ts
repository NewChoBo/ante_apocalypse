import { BasePickupManager, IPickup } from '@ante/game-core';
import { Scene, Vector3 } from '@babylonjs/core';
import { PickupActor, PickupType } from '../entities/PickupActor';
import { PlayerPawn } from '../PlayerPawn';
import { ITickable } from '../interfaces/ITickable';
import { TickManager } from '../TickManager';
import { inventoryStore, BagItem } from '../store/GameStore';
import { GameObservables } from '../events/GameObservables';
import { NetworkManager } from './NetworkManager';
import { EventCode } from '@ante/common';

export class PickupManager extends BasePickupManager implements ITickable {
  private static instance: PickupManager;
  private scene: Scene | null = null;
  private player: PlayerPawn | null = null;
  public readonly priority = 30;
  private networkManager: NetworkManager;

  private constructor() {
    const netManager = NetworkManager.getInstance();
    super(netManager);
    this.networkManager = netManager;
  }

  public static getInstance(): PickupManager {
    if (!PickupManager.instance) {
      PickupManager.instance = new PickupManager();
    }
    return PickupManager.instance;
  }

  public initialize(scene: Scene, player: PlayerPawn): void {
    this.scene = scene;
    this.player = player;

    this.player = player;
    this.networkManager = NetworkManager.getInstance();

    // Networking
    this.networkManager.onEvent.add((event: { code: number; data: unknown }): void => {
      if (event.code === EventCode.SPAWN_PICKUP) {
        this.handleSpawnEvent(
          event.data as {
            id: string;
            position: { x: number; y: number; z: number };
            type: PickupType;
          }
        );
      } else if (event.code === EventCode.DESTROY_PICKUP) {
        this.handleDestroyEvent(event.data as { id: string });
      }
    });

    // 게임 재시작 시 TickManager가 초기화되므로 다시 등록해야 함
    TickManager.getInstance().register(this);
  }

  private handleSpawnEvent(data: {
    id: string;
    position: { x: number; y: number; z: number };
    type: PickupType;
  }): void {
    if (this.pickups.has(data.id)) return;
    const pos = new Vector3(data.position.x, data.position.y, data.position.z);
    this.spawnPickup(pos, data.type, data.id); // Base method call (which calls createPickup)
  }

  private handleDestroyEvent(data: { id: string }): void {
    const pickup = this.pickups.get(data.id) as PickupActor;
    if (pickup) {
      pickup.collect();
      this.pickups.delete(data.id);
    }
  }

  protected createPickup(id: string, type: string, position: Vector3): IPickup {
    if (!this.scene) throw new Error('Scene not initialized');
    const pickup = new PickupActor(this.scene, position, type as PickupType);
    pickup.id = id;
    return pickup;
  }

  public tick(deltaTime: number): void {
    const player = this.player;
    if (!player) return;

    this.pickups.forEach((p, id) => {
      const pickup = p as PickupActor;
      pickup.update(deltaTime);

      if (pickup.destroyed) {
        this.pickups.delete(id);
        return;
      }

      // Collection check. Use local player const to satisfy TS.
      const playerPos = player.mesh.getAbsolutePosition();
      const pickupPos = pickup.mesh.getAbsolutePosition();
      const dx = playerPos.x - pickupPos.x;
      const dz = playerPos.z - pickupPos.z;
      const distSq = dx * dx + dz * dz;
      const collectionRange = 3.0; // 더 넓은 범위

      if (distSq < collectionRange * collectionRange) {
        this.handleCollection(pickup, id);
      }
    }); // End forEach
  }

  private handleCollection(pickup: PickupActor, id: string): void {
    if (!this.player) return;

    try {
      // Logic for inventory addition...
      const { bagItems } = inventoryStore.get();
      const existingItemIndex = bagItems.findIndex((item) => item.id === pickup.type);

      let newBagItems: BagItem[];
      if (existingItemIndex !== -1) {
        // 불변성 유지를 위해 인덱스를 사용하여 새로운 배열 생성
        newBagItems = bagItems.map((item, idx) =>
          idx === existingItemIndex ? { ...item, count: item.count + 1 } : item
        );
      } else {
        newBagItems = [
          ...bagItems,
          {
            id: pickup.type,
            name: pickup.type === 'health_pack' ? 'First Aid Kit' : 'Ammo Crate',
            type: 'consumable',
            count: 1,
          } as BagItem,
        ];
      }

      inventoryStore.setKey('bagItems', newBagItems);
      this.showPopup(`Picked up ${pickup.type}`, '#FF9800');

      // Notify collection for audio/VFX
      GameObservables.itemCollection.notifyObservers({
        itemId: pickup.type,
        position: pickup.mesh.getAbsolutePosition(),
      });

      // Visual collection happens locally,
      // but authority drives state change.
      // Visual collection happens locally,
      // but authority drives state change.
      this.requestDestroyPickup(id);

      pickup.collect();
      this.pickups.delete(id);
    } catch {
      // 에러가 나더라도 일단 박스는 제거 (무한 에러 방지)
      pickup.collect();
      this.pickups.delete(id);
    }
  }

  private showPopup(text: string, color: string): void {
    const popup = document.createElement('div');
    popup.textContent = text;
    popup.style.position = 'fixed';
    popup.style.bottom = '20%';
    popup.style.left = '50%';
    popup.style.transform = 'translateX(-50%)';
    popup.style.color = 'white';
    popup.style.padding = '10px 20px';
    popup.style.borderRadius = '5px';
    popup.style.backgroundColor = color;
    popup.style.fontWeight = 'bold';
    popup.style.zIndex = '1000';
    popup.style.pointerEvents = 'none';
    popup.style.animation = 'fadeOut 1s forwards 0.5s';

    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 1500);
  }

  public clear(): void {
    this.pickups.forEach((p) => p.dispose());
    this.pickups.clear();
  }

  // [Override] Logic for Master Client
  public override requestSpawnPickup(id: string, type: string, position: Vector3): void {
    super.requestSpawnPickup(id, type, position); // Broadcast to Others
    this.spawnPickup(position, type as PickupType, id); // Spawn Locally via Base method
  }

  public override requestDestroyPickup(id: string): void {
    super.requestDestroyPickup(id); // Broadcast to Others
    this.handleDestroyEvent({ id }); // Destroy Locally
  }
}
