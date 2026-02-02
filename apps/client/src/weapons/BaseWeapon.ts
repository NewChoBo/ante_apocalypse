import { Scene, UniversalCamera, Vector3 } from '@babylonjs/core';
import { BaseWeapon as CoreBaseWeapon } from '@ante/game-core';
import { IWeapon } from '../types/IWeapon';
import { WeaponVisualController } from './WeaponVisualController';

/**
 * 모든 무기의 최상위 추상 클래스.
 * WeaponVisualController를 통해 시각적 로직을 포함합니다.
 */
export abstract class BaseWeapon extends CoreBaseWeapon implements IWeapon {
  // IWeapon properties
  public name: string = '';
  public damage: number = 0;
  public range: number = 0;

  // Visual controller (composition pattern)
  protected visualController: WeaponVisualController;

  // Expose visual controller properties for backward compatibility
  public get scene(): Scene {
    return this.visualController.scene;
  }

  public get camera(): UniversalCamera {
    return this.visualController.camera;
  }

  public get weaponMesh() {
    return this.visualController.weaponMesh;
  }

  public set weaponMesh(mesh) {
    this.visualController.weaponMesh = mesh;
  }

  public get isActive(): boolean {
    return this.visualController.isActive;
  }

  public get isAiming(): boolean {
    return this.visualController.isAiming;
  }

  public get onScoreCallback() {
    return this.visualController.onScoreCallback;
  }

  public set onScoreCallback(callback) {
    this.visualController.onScoreCallback = callback;
  }

  constructor(scene: Scene, camera: UniversalCamera, onScore?: (points: number) => void) {
    // Pass dummy stats to core
    super('base_weapon', 'local_player', { name: 'Base', damage: 0, range: 0 });

    // Initialize visual controller with stopFire callback
    this.visualController = new WeaponVisualController(scene, camera, onScore, () =>
      this.stopFire()
    );
  }

  // IWeapon methods - delegate to visual controller
  public show(): void {
    this.visualController.show();
  }

  public hide(): void {
    this.visualController.hide();
  }

  public setAiming(isAiming: boolean): void {
    this.visualController.setAiming(isAiming);
  }

  public lower(): Promise<void> {
    return this.visualController.lower();
  }

  public raise(): void {
    this.visualController.raise();
  }

  public getMovementSpeedMultiplier(): number {
    return this.visualController.getMovementSpeedMultiplier();
  }

  public getDesiredFOV(defaultFOV: number): number {
    return this.visualController.getDesiredFOV(defaultFOV);
  }

  // Abstract methods from IWeapon that must be implemented by concrete classes
  public abstract fire(): boolean;
  public abstract startFire(): void;
  public abstract stopFire(): void;
  public abstract update(deltaTime: number): void;
  public abstract addAmmo(amount: number): void;
  public abstract getStats(): Record<string, unknown>;

  // updateStats with default implementation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public updateStats(stats: Partial<Record<string, any>>): void {
    if (stats.damage !== undefined) this.damage = stats.damage as number;
    if (stats.range !== undefined) this.range = stats.range as number;
  }

  // dispose with default implementation
  public dispose(): void {
    this.visualController.dispose();
  }

  // Protected helper methods for subclasses
  protected setIdleState(): void {
    this.visualController.setIdleState();
  }

  protected updateAnimations(deltaTime: number): void {
    this.visualController.updateAnimations(deltaTime);
  }

  protected processHit(
    pickedMesh: import('@babylonjs/core').Mesh,
    pickedPoint: Vector3,
    damageAmount: number
  ): boolean {
    return this.visualController.processHit(pickedMesh, pickedPoint, damageAmount);
  }
}
