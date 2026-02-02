import { Scene } from '@babylonjs/core';
import { BaseComponent } from './BaseComponent';
import { CameraComponent } from './CameraComponent';
import { WeaponInventoryComponent } from './WeaponInventoryComponent';
import { BasePawn } from '../BasePawn';
import { FirearmEffectComponent } from './FirearmEffectComponent';
import { MeleeEffectComponent } from './MeleeEffectComponent';
import { Firearm } from '../../weapons/Firearm';
import { MeleeWeapon } from '../../weapons/MeleeWeapon';

export interface AimState {
  isAiming: boolean;
  aimProgress: number; // 0.0 to 1.0
}

/**
 * 무기 전투(발사/근접공격) 로직을 담당하는 컴포넌트
 */
export class CombatComponent extends BaseComponent {
  public readonly componentType = 'CombatComponent';

  private inventory: WeaponInventoryComponent;
  private cameraComponent: CameraComponent;

  private firearmEffects: FirearmEffectComponent;
  private meleeEffects: MeleeEffectComponent;

  // Aim state
  private aimState: AimState = { isAiming: false, aimProgress: 0 };
  private aimTransitionSpeed = 5.0; // How fast to transition in/out of aim

  constructor(owner: BasePawn, scene: Scene) {
    super(owner, scene);
    this.cameraComponent = owner.getComponent<CameraComponent>('CameraComponent')!;
    this.inventory = new WeaponInventoryComponent(scene, this.cameraComponent.camera);

    this.firearmEffects = new FirearmEffectComponent(owner, scene);
    this.meleeEffects = new MeleeEffectComponent(owner, scene);
  }

  public update(deltaTime: number): void {
    // Update aim transition
    this.updateAimState(deltaTime);

    // Update current weapon
    const currentWeapon = this.inventory.getCurrentWeapon();
    if (currentWeapon) {
      currentWeapon.update(deltaTime);
    }
  }

  private updateAimState(deltaTime: number): void {
    const targetProgress = this.aimState.isAiming ? 1.0 : 0.0;
    const diff = targetProgress - this.aimState.aimProgress;

    if (Math.abs(diff) > 0.001) {
      this.aimState.aimProgress += diff * this.aimTransitionSpeed * deltaTime;
      this.aimState.aimProgress = Math.max(0, Math.min(1, this.aimState.aimProgress));
    }
  }

  public setAiming(isAiming: boolean): void {
    this.aimState.isAiming = isAiming;
  }

  public isAiming(): boolean {
    return this.aimState.isAiming;
  }

  public getAimProgress(): number {
    return this.aimState.aimProgress;
  }

  public switchWeapon(weaponId: string): boolean {
    return this.inventory.switchToWeapon(weaponId);
  }

  public getCurrentWeapon(): import('../../weapons/BaseWeapon').BaseWeapon | null {
    return this.inventory.getCurrentWeapon() as
      | import('../../weapons/BaseWeapon').BaseWeapon
      | null;
  }

  public startFire(): void {
    const weapon = this.inventory.getCurrentWeapon();
    if (!weapon) return;

    if (weapon instanceof Firearm) {
      weapon.startFire();
    } else if (weapon instanceof MeleeWeapon) {
      // Use type assertion to access protected method
      (weapon as MeleeWeapon)['startSwing']();
    }
  }

  public stopFire(): void {
    const weapon = this.inventory.getCurrentWeapon();
    if (weapon instanceof Firearm) {
      weapon.stopFire();
    }
  }

  public reload(): void {
    const weapon = this.inventory.getCurrentWeapon();
    if (weapon instanceof Firearm) {
      weapon.reload();
    }
  }

  public addAmmoToAll(amount: number): void {
    this.inventory.addAmmoToAll(amount);
  }

  // Alias for SessionController compatibility
  public equipWeapon(weaponId: string): boolean {
    return this.switchWeapon(weaponId);
  }

  // Get all weapons for SessionController
  public getWeapons(): import('../../weapons/BaseWeapon').BaseWeapon[] {
    return this.inventory.getWeapons() as import('../../weapons/BaseWeapon').BaseWeapon[];
  }

  // Subscribe to weapon changes for SessionController
  public onWeaponChanged(callback: (weapon: { name: string }) => void): void {
    this.inventory.onWeaponChanged.add((weapon) => {
      callback({ name: weapon.name });
    });
  }

  public dispose(): void {
    this.inventory.dispose();
    this.firearmEffects.dispose();
    this.meleeEffects.dispose();
  }
}
