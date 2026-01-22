import * as THREE from 'three';

// ===== Core Interfaces =====

export interface IUpdatable {
  update(delta: number): void;
}

export interface IDestroyable {
  destroy(): void;
}

// ===== Entity Interfaces =====

export interface IEntity extends IUpdatable, IDestroyable {
  mesh: THREE.Object3D;
}

export interface IDamageable {
  health: number;
  maxHealth: number;
  takeDamage(amount: number): void;
  heal(amount: number): void;
  isDead(): boolean;
}

export interface IInteractable {
  canInteract(player: unknown): boolean;
  interact(player: unknown): void;
  getInteractionPrompt(): string;
}

// ===== Weapon Interfaces =====

export interface IWeapon extends IUpdatable {
  mesh: THREE.Group;
  currentAmmo: number;
  totalAmmo: number;
  isReloading: boolean;
  
  shoot(): boolean;
  reload(onComplete: () => void): void;
  canShoot(): boolean;
  canReload(): boolean;
}

export interface IWeaponConfig {
  name: string;
  maxAmmo: number;
  totalAmmo: number;
  reloadTime: number;
  recoilForce: number;
  damage: number;
  range: number;
}

// ===== Combat Interfaces =====

export interface IHitResult {
  hit: boolean;
  target?: IDamageable;
  point?: THREE.Vector3;
  distance?: number;
}
