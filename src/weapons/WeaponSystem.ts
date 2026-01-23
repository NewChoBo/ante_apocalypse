import { Scene, UniversalCamera } from '@babylonjs/core';
import { IWeapon } from '../types/IWeapon.ts';
import { Rifle } from './Rifle.ts';
import { Pistol } from './Pistol.ts';
import { TargetManager } from '../targets/TargetManager.ts';

/**
 * 무기 시스템 매니저.
 * 플레이어의 무기를 관리하고 점수를 추적합니다.
 */
export class WeaponSystem {
  private weapons: IWeapon[] = [];
  private currentWeaponIndex = 0;
  public score = 0;

  constructor(scene: Scene, camera: UniversalCamera, targetManager: TargetManager) {
    const scoreCallback = (points: number) => this.addScore(points);

    this.weapons = [
      new Pistol(scene, camera, targetManager, scoreCallback),
      new Rifle(scene, camera, targetManager, scoreCallback),
    ];

    // 첫 번째 무기만 표시, 나머지는 숨김
    this.weapons.forEach((weapon, index) => {
      if (index === this.currentWeaponIndex) {
        weapon.show();
      } else {
        weapon.hide();
      }
    });

    this.setupInputEvents();
  }

  private get currentWeapon(): IWeapon {
    return this.weapons[this.currentWeaponIndex];
  }

  private setupInputEvents(): void {
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0 && document.pointerLockElement) {
        this.currentWeapon.startFire();
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.currentWeapon.stopFire();
      }
    });

    document.addEventListener('keydown', (e) => {
      switch (e.code) {
        case 'Digit1':
          this.switchWeapon(0);
          break;
        case 'Digit2':
          this.switchWeapon(1);
          break;
        case 'KeyR':
          this.currentWeapon.reload();
          break;
      }
    });
  }

  private switchWeapon(index: number): void {
    if (index === this.currentWeaponIndex) return;
    if (index < 0 || index >= this.weapons.length) return;

    // 현재 무기 숨기기
    this.currentWeapon.hide();

    this.currentWeaponIndex = index;

    // 새 무기 표시
    this.currentWeapon.show();
  }

  private addScore(points: number): void {
    this.score += points;
  }

  public update(deltaTime: number): void {
    this.currentWeapon.update(deltaTime);
  }

  public get currentAmmo(): number {
    return this.currentWeapon.currentAmmo;
  }

  public get reserveAmmo(): number {
    return this.currentWeapon.reserveAmmo;
  }

  public get weaponStats(): any {
    return this.currentWeapon.getStats();
  }
}
