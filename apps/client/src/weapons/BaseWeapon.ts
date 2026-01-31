import { Scene, UniversalCamera } from '@babylonjs/core';
import { BaseWeapon as CoreBaseWeapon } from '@ante/game-core';
import { IWeapon } from '../types/IWeapon';
import { ClientWeaponMixin } from './ClientWeaponMixin';

// Define base with Mixin
// @ts-ignore
const VisualBaseWeapon = ClientWeaponMixin(CoreBaseWeapon);

/**
 * 모든 무기의 최상위 추상 클래스.
 * Mixin을 통해 시각적 로직을 포함합니다.
 */
export abstract class BaseWeapon extends VisualBaseWeapon implements IWeapon {
  // Abstract props from IWeapon that might not be in Core or Mixin explicitly
  // but inherited from Mixin implementation or Core.
  // CoreBaseWeapon has: id, ownerId, stats.
  // IWeapon expects: name, damage, range.
  // VisualBaseWeapon (Mixin) defines: name, damage, range as public props.

  constructor(scene: Scene, camera: UniversalCamera, onScore?: (points: number) => void) {
    // Pass dummy stats to core
    super('base_weapon', 'local_player', { name: 'Base', damage: 0, range: 0 });

    // Mixin Init
    this.initVisuals(scene, camera, onScore);
  }

  // Abstract methods from IWeapon that must be implemented by concrete classes
  public abstract fire(): boolean;
  public abstract startFire(): void;
  public abstract stopFire(): void;
  public abstract update(deltaTime: number): void;
  public abstract addAmmo(amount: number): void;
  public abstract getStats(): Record<string, unknown>;
}
