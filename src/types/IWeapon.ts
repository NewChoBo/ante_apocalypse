import { Vector3, TransformNode, Observable } from '@babylonjs/core';
import { IWeaponStats } from './IWeaponStats';

/**
 * 총구의 위치와 방향을 제공하는 인터페이스.
 */
export interface IMuzzleProvider {
  getMuzzleTransform(): {
    position: Vector3;
    direction: Vector3;
    transformNode?: TransformNode;
  };
}

/**
 * 모든 무기(총기, 근접 무기 등)의 핵심 인터페이스.
 */
export interface IWeapon extends IWeaponStats {
  // Methods not in Shared Stats
  fire(): boolean;
  startFire(): void;
  stopFire(): void;
  update(deltaTime: number): void;
  getStats(): Record<string, unknown>;
  show(): void;
  hide(): void;
  lower(): Promise<void>;
  raise(): void;
  getMovementSpeedMultiplier(): number;
  getDesiredFOV(defaultFOV: number): number;
  setAiming(isAiming: boolean): void;
  addAmmo(amount: number): void;
  dispose(): void;

  // Prediction Events
  onFirePredicted: Observable<IWeapon>;
  onHitPredicted: Observable<{ position: Vector3; normal: Vector3 }>;
}

/**
 * 총기류 전용 인터페이스
 */
export interface MuzzleTransform {
  position: Vector3;
  direction: Vector3;
  transformNode?: TransformNode;
  localMuzzlePosition?: Vector3;
}

export interface IFirearm extends IWeapon {
  currentAmmo: number;
  // magazineSize, etc are inherited from IWeaponStats (Generic) but we might want to enforce them as non-optional?
  // Since IFirearm needs them.
  magazineSize: number;
  reserveAmmo: number;
  fireRate: number;
  reloadTime: number;
  firingMode: 'semi' | 'auto';
  recoilForce: number;

  reload(): void;

  getMuzzleTransform(): MuzzleTransform;
}
