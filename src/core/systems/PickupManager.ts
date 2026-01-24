import { Scene, Vector3 } from '@babylonjs/core';
import { PickupActor, PickupType } from '../entities/PickupActor';
import { PlayerPawn } from '../PlayerPawn';
import { ITickable } from '../interfaces/ITickable';
import { TickManager } from '../TickManager';

export class PickupManager implements ITickable {
  private static instance: PickupManager;
  private scene: Scene | null = null;
  private player: PlayerPawn | null = null;
  private pickups: PickupActor[] = [];
  public readonly priority = 30;

  private constructor() {
    TickManager.getInstance().register(this);
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
  }

  public spawnPickup(position: Vector3, type: PickupType): void {
    if (!this.scene) return;
    const pickup = new PickupActor(this.scene, position, type);
    this.pickups.push(pickup);
  }

  public spawnRandomPickup(position: Vector3): void {
    // 40% chance to spawn an item
    if (Math.random() > 0.4) return;

    const type: PickupType = Math.random() > 0.5 ? 'health' : 'ammo';
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

      // Collection check
      const distance = Vector3.Distance(this.player.position, pickup.position);
      if (distance < 2.0) {
        this.handleCollection(pickup);
        this.pickups.splice(i, 1);
      }
    }
  }

  private handleCollection(pickup: PickupActor): void {
    if (!this.player) return;

    if (pickup.type === 'health') {
      (this.player as any).addHealth?.(30);
    } else {
      (this.player as any).addAmmo?.(50);
    }

    pickup.collect();
    console.log(`Collected ${pickup.type}`);
  }

  public clear(): void {
    this.pickups.forEach((p) => p.dispose());
    this.pickups = [];
  }
}
