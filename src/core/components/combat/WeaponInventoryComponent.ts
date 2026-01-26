import { Scene, Observable, Mesh } from '@babylonjs/core';
import { BaseComponent } from '../base/BaseComponent';
import { CameraComponent } from '../movement/CameraComponent';
import { HUDSyncComponent } from '../network/HUDSyncComponent';
import { IWeapon } from '../../../types/IWeapon';
import { inventoryStore } from '../../store/GameStore';
import { Pistol } from '../../../weapons/Pistol';
import { Rifle } from '../../../weapons/Rifle';
import { Knife } from '../../../weapons/Knife';
import { Bat } from '../../../weapons/Bat';
import type { IPawn } from '../../../types/IPawn';

/**
 * 캐릭터가 보유한 무기들을 관리하고 교체 로직을 담당하는 컴포넌트.
 */
export class WeaponInventoryComponent extends BaseComponent {
  public name = 'WeaponInventory';
  private weapons: IWeapon[] = [];
  private currentWeaponIndex = 0;

  /** 무기가 변경될 때 호출되는 Observable */
  public onWeaponChanged = new Observable<IWeapon>();

  constructor(owner: IPawn, scene: Scene) {
    super(owner, scene);
  }

  public attach(target: Mesh): void {
    super.attach(target);

    const cameraComp = this.owner.getComponent(CameraComponent);
    const hudSync = this.owner.getComponent(HUDSyncComponent);

    if (!cameraComp || !hudSync) {
      // console.warn('[WeaponInventory] Required components (Camera/HUDSync) not found on Pawn yet.');
      return;
    }

    const camera = cameraComp.camera;
    const onScore = (points: number): void => hudSync.updateScore(points);
    const applyRecoil = (force: number): void => cameraComp.applyRecoil(force);

    this.weapons = [
      new Pistol(this.scene, camera, onScore, applyRecoil),
      new Rifle(this.scene, camera, onScore, applyRecoil),
      new Knife(this.scene, camera, onScore),
      new Bat(this.scene, camera, onScore),
    ];

    // 초기 상태 설정
    this.weapons.forEach((w, i) => (i === 0 ? w.show() : w.hide()));
  }

  public detach(): void {
    this.weapons.forEach((w) => w.dispose());
    this.weapons = [];
    super.detach();
  }

  public get currentWeapon(): IWeapon {
    return this.weapons[this.currentWeaponIndex];
  }

  private isSwitching = false;

  public async switchWeapon(index: number): Promise<void> {
    if (this.isSwitching || index === this.currentWeaponIndex) return;
    if (index < 0 || index >= this.weapons.length) return;

    this.isSwitching = true;

    // 1. 현재 무기 내리기
    await this.currentWeapon.lower();
    this.currentWeapon.hide();

    // 2. 무기 교체
    this.currentWeaponIndex = index;

    // 3. 새 무기 올리기
    this.currentWeapon.raise();

    this.onWeaponChanged.notifyObservers(this.currentWeapon);

    this.isSwitching = false;
  }

  public getWeapons(): IWeapon[] {
    return this.weapons;
  }

  public async switchWeaponBySlot(slotIndex: number): Promise<void> {
    const state = inventoryStore.get();
    const weaponId = state.weaponSlots[slotIndex];
    if (weaponId) {
      await this.equipWeaponById(weaponId);
    }
  }

  public async equipWeaponById(id: string): Promise<void> {
    const index = this.weapons.findIndex((w) => w.name === id);
    if (index !== -1) {
      await this.switchWeapon(index);
    }
  }

  public update(deltaTime: number): void {
    this.currentWeapon.update(deltaTime);
  }

  public addAmmoToAll(amount: number): void {
    this.weapons.forEach((w) => w.addAmmo(amount));
  }

  public dispose(): void {
    this.weapons.forEach((w) => w.dispose());
  }
}
