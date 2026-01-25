import { Scene, Vector3 } from '@babylonjs/core';
import { PickupActor, PickupType } from '../entities/PickupActor';
import { PlayerPawn } from '../PlayerPawn';
import { ITickable } from '../interfaces/ITickable';
import { TickManager } from '../TickManager';
import { inventoryStore, BagItem } from '../store/GameStore';
import { GameObservables } from '../events/GameObservables';

export class PickupManager implements ITickable {
  private static instance: PickupManager;
  private scene: Scene | null = null;
  private player: PlayerPawn | null = null;
  private pickups: PickupActor[] = [];
  public readonly priority = 30;

  private constructor() {
    // Singleton
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

    // 게임 재시작 시 TickManager가 초기화되므로 다시 등록해야 함
    TickManager.getInstance().register(this);
  }

  public spawnPickup(position: Vector3, type: PickupType): void {
    if (!this.scene) return;
    const pickup = new PickupActor(this.scene, position, type);
    this.pickups.push(pickup);
  }

  public spawnRandomPickup(position: Vector3): void {
    // 40% chance to spawn an item
    if (Math.random() > 0.4) return;

    const type: PickupType = Math.random() > 0.5 ? 'health_pack' : 'ammo_box';
    this.spawnPickup(position, type);
  }

  public tick(deltaTime: number): void {
    if (!this.player) return;

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i];
      pickup.update(deltaTime);

      if (pickup.destroyed) {
        this.pickups.splice(i, 1);
        continue;
      }

      // Collection check (Using 2D distance for more forgiving pickup)
      const playerPos = this.player.mesh.getAbsolutePosition();
      const pickupPos = pickup.mesh.getAbsolutePosition();
      const dx = playerPos.x - pickupPos.x;
      const dz = playerPos.z - pickupPos.z;
      const distSq = dx * dx + dz * dz;
      const collectionRange = 3.0; // 더 넓은 범위

      if (distSq < collectionRange * collectionRange) {
        console.log(`[PickupManager] Inside collection range. distSq: ${distSq.toFixed(2)}`);
        this.handleCollection(pickup);
        this.pickups.splice(i, 1);
      }
    }
  }

  private handleCollection(pickup: PickupActor): void {
    if (!this.player) return;

    try {
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

      pickup.collect();
      console.log(`[PickupManager] Stored ${pickup.type} in bag`);
    } catch (e) {
      console.error(`[PickupManager] Error storing ${pickup.type}:`, e);
      // 에러가 나더라도 일단 박스는 제거 (무한 에러 방지)
      pickup.collect();
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
    this.pickups = [];
  }
}
