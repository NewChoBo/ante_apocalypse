import { Scene, UniversalCamera } from '@babylonjs/core';
import { IWeapon } from '../../types/IWeapon';
import { inventoryStore } from '../store/GameStore';
import { Pistol } from '../../weapons/Pistol';
import { Rifle } from '../../weapons/Rifle';
import { Knife } from '../../weapons/Knife';
import { Bat } from '../../weapons/Bat';

/**
 * 캐릭터가 보유한 무기들을 관리하고 교체 로직을 담당하는 컴포넌트.
 */
export class WeaponInventoryComponent {
  private weapons: IWeapon[] = [];
  private currentWeaponIndex = 0;
  private onWeaponChanged?: (weapon: IWeapon) => void;

  public setOnWeaponChanged(callback: (weapon: IWeapon) => void): void {
    this.onWeaponChanged = callback;
  }

  constructor(
    scene: Scene,
    camera: UniversalCamera,
    onScore: (points: number) => void,
    applyRecoil?: (force: number) => void,
    onWeaponChanged?: (weapon: IWeapon) => void
  ) {
    this.onWeaponChanged = onWeaponChanged;

    this.weapons = [
      new Pistol(scene, camera, onScore, applyRecoil),
      new Rifle(scene, camera, onScore, applyRecoil),
      new Knife(scene, camera, onScore),
      new Bat(scene, camera, onScore),
    ];

    // 초기 상태 설정
    this.weapons.forEach((w, i) => (i === 0 ? w.show() : w.hide()));
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

    if (this.onWeaponChanged) {
      this.onWeaponChanged(this.currentWeapon);
    }

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
