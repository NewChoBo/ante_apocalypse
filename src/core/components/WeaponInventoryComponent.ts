import { Scene, UniversalCamera } from '@babylonjs/core';
import { IWeapon } from '../../types/IWeapon';
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

  public switchWeapon(index: number): void {
    if (index === this.currentWeaponIndex) return;
    if (index < 0 || index >= this.weapons.length) return;

    this.currentWeapon.hide();
    this.currentWeaponIndex = index;
    this.currentWeapon.show();

    if (this.onWeaponChanged) {
      this.onWeaponChanged(this.currentWeapon);
    }
  }

  public update(deltaTime: number): void {
    this.currentWeapon.update(deltaTime);
  }

  public dispose(): void {
    this.weapons.forEach((w) => w.dispose());
  }
}
