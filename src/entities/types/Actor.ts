import * as THREE from 'three';
import { BaseEntity } from '../BaseEntity';

export class Actor extends BaseEntity {
  protected health: number = 100;

  constructor(scene: THREE.Scene) {
    super(scene);
  }

  public takeDamage(amount: number): void {
    this.health -= amount;
    if (this.health <= 0) {
      this.die();
    }
  }

  protected die(): void {
    this.destroy();
  }

  public update(_delta: number): void {
    // Basic AI or movement logic for actors
  }
}
