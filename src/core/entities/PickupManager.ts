import { Scene, Vector3 } from '@babylonjs/core';
import { PickupActor, PickupType } from '../entities/PickupActor';
import { PlayerPawn } from '../pawns/PlayerPawn';
import { IGameSystem } from '../../types/IGameSystem';
import { TickManager } from '../managers/TickManager';
import { InventoryManager } from '../inventory/InventoryManager';
import { GameObservables } from '../events/GameObservables';
import { NetworkMediator } from '../network/NetworkMediator';
import { EventCode } from '../../shared/protocol/NetworkProtocol';

export class PickupManager implements IGameSystem {
  private static instance: PickupManager;
  private scene: Scene | null = null;
  private player: PlayerPawn | null = null;
  private pickups: Map<string, PickupActor> = new Map();
  public readonly priority = 30;
  private networkMediator: NetworkMediator;

  private constructor() {
    this.networkMediator = NetworkMediator.getInstance();
  }

  public static getInstance(): PickupManager {
    if (!PickupManager.instance) {
      PickupManager.instance = new PickupManager();
    }
    return PickupManager.instance;
  }

  public initialize(): void {
    // SessionController에서 주입받아 초기화
  }

  public setup(scene: Scene, player: PlayerPawn): void {
    this.scene = scene;
    this.player = player;

    // Networking
    this.networkMediator.onPickupSpawnRequested.add((data) => {
      this.handleSpawnEvent(data);
    });

    this.networkMediator.onPickupDestroyRequested.add((data) => {
      this.handleDestroyEvent(data);
    });

    // Client: Handle granted pickup
    this.networkMediator.onItemPicked.add((data) => {
      this.grantPickupToInventory(data.id, data.type, data.ownerId);
    });

    // 게임 재시작 시 TickManager가 초기화되므로 다시 등록해야 함
    TickManager.getInstance().register({
      priority: this.priority,
      tick: (dt) => this.tick(dt),
    });
  }

  private handleSpawnEvent(data: {
    id: string;
    position: { x: number; y: number; z: number };
    type: string;
  }): void {
    if (this.pickups.has(data.id)) return;
    const pos = new Vector3(data.position.x, data.position.y, data.position.z);
    this.spawnPickup(pos, data.type as PickupType, data.id, false); // False = don't broadcast
  }

  private handleDestroyEvent(data: { id: string }): void {
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
    // Attach ID to pickup for Lookup
    (pickup as { networkId?: string }).networkId = pickupId;

    this.pickups.set(pickupId, pickup);

    // Client-side spawning for effect ONLY if triggered by event.
    // If called manually on Master, it should instead request server to spawn?
    // Actually, createPickup is usually called by handleSpawnEvent.
    // If we want to safeguard against manual calls:
    if (broadcast) {
      console.warn(
        '[PickupManager] Manual spawnPickup call with broadcast=true is deprecated. Use ServerGameController.'
      );
    }
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
      const collectionRange = 3.0;

      if (distSq < collectionRange * collectionRange) {
        this.handleCollection(pickup, id);
      }
    });
  }

  private handleCollection(pickup: PickupActor, id: string): void {
    if (!this.player || pickup.destroyed) return;

    // Single player mode: Grant immediately
    if (!this.networkMediator.getSocketId()) {
      this.grantPickupToInventory(id, pickup.type, 'local');
      this.pickups.delete(id);
      pickup.collect();
      return;
    }

    // Standard Server-Authoritative Logic: Always Request
    const pos = pickup.mesh.getAbsolutePosition();
    this.networkMediator.sendEvent(EventCode.REQ_TRY_PICKUP, {
      id,
      position: { x: pos.x, y: pos.y, z: pos.z },
    });

    // Optimistic: Mark as destroyed locally to prevent multiple request spamming
    pickup.destroyed = true;
  }

  // Executed on Master Client - DEPRECATED
  // private processPickupRequest(pickupId: string, requesterId: string): void {
  //   ...
  // }

  private grantPickupToInventory(_id: string, type: string, ownerId: string): void {
    const myId = this.networkMediator.getSocketId() || 'local';
    if (ownerId !== myId) {
      return;
    }

    // Logic for inventory addition using InventoryManager for consistency
    const success = InventoryManager.addItemToBag(type, 1);
    if (!success) {
      this.showPopup(`Inventory Full!`, '#F44336');
      return;
    }

    this.showPopup(`Picked up ${type}`, '#FF9800');

    // Play local sound
    GameObservables.itemCollection.notifyObservers({
      itemId: type,
      position: this.player?.mesh.getAbsolutePosition() || Vector3.Zero(),
    });
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

  public dispose(): void {
    this.clear();
  }

  public clear(): void {
    this.pickups.forEach((p) => p.dispose());
    this.pickups.clear();
  }
}
