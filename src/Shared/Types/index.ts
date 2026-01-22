import * as THREE from 'three';

export interface IUpdatable {
  update(delta: number): void;
}

export interface IDestroyable {
  destroy(): void;
}

export interface IEntity extends IUpdatable, IDestroyable {
  readonly mesh: THREE.Object3D;
  readonly id?: string | number;
}

export interface IHittable {
  hit(damage?: number): void;
  isAlive(): boolean;
}

export interface IDamageable extends IHittable {
  health: number;
  readonly maxHealth: number;
  takeDamage(amount: number): void;
  heal(amount: number): void;
}
