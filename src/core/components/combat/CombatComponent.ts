import { Scene, Observer, Observable } from '@babylonjs/core';
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

    // 1. 컴포넌트들 생성 및 등록
    this.hudSync = new HUDSyncComponent(owner, scene);
    this.owner.addComponent(this.hudSync);

    this.inventory = new WeaponInventoryComponent(owner, scene);
    this.owner.addComponent(this.inventory);

    this.input = new WeaponInputComponent(owner, scene);
    this.owner.addComponent(this.input);

    // 2. 이벤트 연결 (컴포넌트들이 Mesh에 attach된 후 안전해짐)
    // 무기 변경 시 HUD 동기화 리스너 등록
    this.inventory.onWeaponChanged.add((newWeapon) => {
      this.hudSync.syncAmmo(newWeapon);
      this.bindWeaponEvents(newWeapon);
    });

    // 초기 HUD 동기화 및 바인딩
    this.hudSync.syncAmmo(this.inventory.currentWeapon);
    this.bindWeaponEvents(this.inventory.currentWeapon);

    // 이펙트 컴포넌트 초기화 및 등록
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

  public dispose(): void {
    if (this.boundWeapon && this.weaponObserver) {
      this.boundWeapon.onFirePredicted.remove(this.weaponObserver);
    }
    super.dispose();
    this.inventory.dispose();
    this.input.dispose();
  }
}
