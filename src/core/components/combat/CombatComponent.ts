import { Scene, Observer, Observable, Mesh } from '@babylonjs/core';
import { BaseComponent } from '../base/BaseComponent';
import { WeaponInventoryComponent } from './WeaponInventoryComponent';
import { IWeapon } from '../../../types/IWeapon';
import { WeaponInputComponent } from './WeaponInputComponent';
import { HUDSyncComponent } from '../network/HUDSyncComponent';
import { FirearmEffectComponent } from './FirearmEffectComponent';
import { MeleeEffectComponent } from './MeleeEffectComponent';
import { ImpactEffectComponent } from './ImpactEffectComponent';
import { CameraComponent } from '../movement/CameraComponent';
import type { IPawn } from '../../../types/IPawn';
import { crosshairKickStore } from '../../store/GameStore';
import { NetworkManager } from '../../network/NetworkManager';
import { ReqFirePayload } from '../../network/NetworkProtocol';

/**
 * 캐릭터의 무기 인벤토리, 입력, UI 동기화를 조율하는 컴포넌트.
 */
export class CombatComponent extends BaseComponent {
  public name = 'Combat';
  private inventory: WeaponInventoryComponent;
  private input: WeaponInputComponent;
  private hudSync: HUDSyncComponent;

  private boundWeapon: IWeapon | null = null;
  private weaponObserver: Observer<IWeapon> | null = null;

  constructor(owner: IPawn, scene: Scene) {
    super(owner, scene);

    const cameraComp = owner.getComponent(CameraComponent);
    if (!cameraComp) {
      throw new Error('CombatComponent requires a CameraComponent on the Pawn');
    }

    // Components are created but not added yet to allow CombatComponent to be added to Pawn first
    this.hudSync = new HUDSyncComponent(owner, scene);
    this.inventory = new WeaponInventoryComponent(owner, scene);
    this.input = new WeaponInputComponent(owner, scene);
  }

  public attach(target: Mesh): void {
    super.attach(target);

    // 1. Add sub-components to the owner
    // Since CombatComponent is now attached, it is in the owner's component list.
    this.owner.addComponent(this.hudSync);
    this.owner.addComponent(this.inventory);
    this.owner.addComponent(this.input);

    // 2. Setup events
    this.inventory.onWeaponChanged.add((newWeapon) => {
      this.hudSync.syncAmmo(newWeapon);
      this.bindWeaponEvents(newWeapon);
    });

    // Initial HUD sync and binding
    this.hudSync.syncAmmo(this.inventory.currentWeapon);
    this.bindWeaponEvents(this.inventory.currentWeapon);

    // Effect components
    this.attachEffect(FirearmEffectComponent);
    this.attachEffect(MeleeEffectComponent);
    this.attachEffect(ImpactEffectComponent);
  }

  private bindWeaponEvents(weapon: IWeapon): void {
    if (this.boundWeapon && this.weaponObserver) {
      if (this.boundWeapon.onFirePredicted) {
        this.boundWeapon.onFirePredicted.remove(this.weaponObserver);
      }
      this.weaponObserver = null;
    }

    this.boundWeapon = weapon;
    if (weapon && weapon.onFirePredicted) {
      this.weaponObserver = weapon.onFirePredicted.add(() => {
        crosshairKickStore.set(crosshairKickStore.get() + 1);
      });
    }
  }

  private attachEffect<T extends BaseComponent>(
    componentClass: new (owner: IPawn, scene: Scene) => T
  ): T {
    const comp = new componentClass(this.owner, this.scene);
    this.owner.addComponent(comp);
    return comp;
  }

  public update(deltaTime: number): void {
    this.inventory.update(deltaTime);
  }

  public getCurrentWeapon(): IWeapon {
    return this.inventory.currentWeapon;
  }

  public getWeapons(): IWeapon[] {
    return this.inventory.getWeapons();
  }

  public async equipWeapon(id: string): Promise<void> {
    await this.inventory.equipWeaponById(id);
  }

  public get onWeaponChanged(): Observable<IWeapon> {
    return this.inventory.onWeaponChanged;
  }

  public addAmmoToAll(amount: number): void {
    this.inventory.addAmmoToAll(amount);
  }

  public fire(): void {
    const weapon = this.getCurrentWeapon();
    if (weapon) {
      // 1. Prediction: Immediately play visuals/audio via weapon's internal event
      // Do NOT deduct ammo/HP locally.
      const muzzle = (weapon as any).getMuzzleTransform
        ? (weapon as any).getMuzzleTransform()
        : null;
      const fired = weapon.fire();

      if (fired) {
        // 2. Authority: Send request to server
        const network = NetworkManager.getInstance();
        const req = new ReqFirePayload(
          weapon.name,
          muzzle
            ? {
                position: { x: muzzle.position.x, y: muzzle.position.y, z: muzzle.position.z },
                direction: { x: muzzle.direction.x, y: muzzle.direction.y, z: muzzle.direction.z },
              }
            : undefined
        );

        network.requestFire(req);

        // UI/Prediction logic
        crosshairKickStore.set(crosshairKickStore.get() + 1);
      }
    }
  }

  public startFire(): void {
    const weapon = this.getCurrentWeapon();
    if (weapon) weapon.startFire();
  }

  public stopFire(): void {
    const weapon = this.getCurrentWeapon();
    if (weapon) weapon.stopFire();
  }

  public reload(): void {
    const weapon = this.getCurrentWeapon();
    const firearm = weapon as { reload?(): void };
    if (firearm && firearm.reload) {
      firearm.reload();
    }
  }

  public dispose(): void {
    if (this.boundWeapon && this.weaponObserver) {
      this.boundWeapon.onFirePredicted.remove(this.weaponObserver);
    }
    super.dispose();
    this.inventory.dispose();
    this.input.dispose();
  }
}
