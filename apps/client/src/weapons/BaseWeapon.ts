import { Scene, UniversalCamera, Vector3, AbstractMesh } from '@babylonjs/core';
import { BaseWeapon as CoreBaseWeapon, WithStatSync, WeaponStats } from '@ante/game-core';
import { IWeapon } from '../types/IWeapon';
import { WeaponVisualController } from './WeaponVisualController';
import type { GameContext } from '../types/GameContext';

/**
 * 모든 무기의 최상위 추상 클래스.
 * WithStatSync Mixin을 통해 동기화 기능을, WeaponVisualController를 통해 시각적 로직을 포함합니다.
 */
export abstract class BaseWeapon
  extends WithStatSync<typeof CoreBaseWeapon, WeaponStats>(CoreBaseWeapon)
  implements IWeapon
{
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

  public get weaponMesh(): AbstractMesh | null {
    return this.visualController.weaponMesh;
  }

  public set weaponMesh(mesh: AbstractMesh | null) {
    this.visualController.weaponMesh = mesh;
  }

  public get isActive(): boolean {
    return this.visualController.isActive;
  }

  public get isAiming(): boolean {
    return this.visualController.isAiming;
  }

  protected ctx: GameContext;

  constructor(context: GameContext) {
    // Pass only id and ownerId to core
    super('base_weapon', 'local_player');

    this.ctx = context;
    // Initialize visual controller with stopFire callback
    this.visualController = new WeaponVisualController(context, () => this.stopFire());
  }

  /**
   * Mixin의 stats 업데이트 시 시각적 속성들도 동기화합니다.
   */
  public override onStatsUpdated(stats: Partial<WeaponStats>): void {
    if (stats.damage !== undefined) this.damage = stats.damage;
    if (stats.range !== undefined) this.range = stats.range;
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

  /**
   * IWeapon 인터페이스를 만족시키기 위한 래퍼.
   * Mixin의 구체적인 타입을 IWeapon의 레코드 타입으로 변환합니다.
   */
  public override updateStats(stats: Partial<Record<string, unknown>>): void {
    super.updateStats(stats as Partial<WeaponStats>);
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
