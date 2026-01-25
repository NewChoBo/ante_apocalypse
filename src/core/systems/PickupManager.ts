import { Scene, Vector3 } from '@babylonjs/core';
import { PickupActor, PickupType } from '../entities/PickupActor';
import { PlayerPawn } from '../PlayerPawn';
import { ITickable } from '../interfaces/ITickable';
import { TickManager } from '../TickManager';
import { inventoryStore, BagItem } from '../store/GameStore';
import { GameObservables } from '../events/GameObservables';
import { NetworkManager } from './NetworkManager';
import { EventCode } from '../network/NetworkProtocol';

export class PickupManager implements ITickable {
  private static instance: PickupManager;
  private scene: Scene | null = null;
  private player: PlayerPawn | null = null;
  private pickups: Map<string, PickupActor> = new Map();
  public readonly priority = 30;
  private networkManager: NetworkManager;

  private constructor() {
    this.networkManager = NetworkManager.getInstance();
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
    this.networkManager.onEvent.add((event) => {
      if (event.code === EventCode.SPAWN_PICKUP) {
        this.handleSpawnEvent(event.data);
      } else if (event.code === EventCode.DESTROY_PICKUP) {
        this.handleDestroyEvent(event.data);
      }
    });

    // 게임 재시작 시 TickManager가 초기화되므로 다시 등록해야 함
    TickManager.getInstance().register(this);
  }

  private handleSpawnEvent(data: any): void {
    if (this.pickups.has(data.id)) return;
    const pos = new Vector3(data.position.x, data.position.y, data.position.z);
    this.spawnPickup(pos, data.type, data.id, false); // False = don't broadcast
  }

  private handleDestroyEvent(data: any): void {
    const pickup = this.pickups.get(data.id);
    if (pickup) {
      pickup.collect();
      this.pickups.delete(data.id);
    }
  }

  public spawnPickup(
    position: Vector3,
    type: PickupType,
    id?: string,
    broadcast: boolean = true
  ): void {
    if (!this.scene) return;

    // ID generation if not provided (Master origin)
    const pickupId = id || `pickup_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const pickup = new PickupActor(this.scene, position, type);
    // Attach ID to pickup for Lookup? Or just use Map.
    // We need to know ID when collecting.
    (pickup as any).networkId = pickupId;

    this.pickups.set(pickupId, pickup);

    if (broadcast && (this.networkManager.isMasterClient() || !this.networkManager.getSocketId())) {
      // Only Master broadcasts spawns ideally, but if we allow local spawn...
      // Plan: Only Master logic calls this without ID.
      if (this.networkManager.isMasterClient()) {
        this.networkManager.sendEvent(EventCode.SPAWN_PICKUP, {
          id: pickupId,
          type,
          position: { x: position.x, y: position.y, z: position.z },
        });
      }
    }
  }

  public spawnRandomPickup(position: Vector3): void {
    // Only Master decides spawning drops
    if (!this.networkManager.isMasterClient() && this.networkManager.getSocketId()) return;

    // 40% chance to spawn an item
    if (Math.random() > 0.4) return;

    const type: PickupType = Math.random() > 0.5 ? 'health_pack' : 'ammo_box';
    this.spawnPickup(position, type);
  }

  public tick(deltaTime: number): void {
    const player = this.player;
    if (!player) return;

    this.pickups.forEach((pickup, id) => {
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
        console.log(`[PickupManager] Inside collection range. distSq: ${distSq.toFixed(2)}`);
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

      // Notify others
      this.networkManager.sendEvent(EventCode.DESTROY_PICKUP, { id });

      pickup.collect();
      this.pickups.delete(id);

      console.log(`[PickupManager] Stored ${pickup.type} in bag`);
    } catch (e) {
      console.error(`[PickupManager] Error storing ${pickup.type}:`, e);
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
}
