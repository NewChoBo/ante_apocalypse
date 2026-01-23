import { Scene, UniversalCamera } from '@babylonjs/core';
import { IWeapon } from '../types/IWeapon.ts';
import { Rifle } from './Rifle.ts';
import { Pistol } from './Pistol.ts';
import { Knife } from './Knife.ts';
import { Bat } from './Bat.ts';
import { TargetManager } from '../targets/TargetManager.ts';
import { scoreStore, ammoStore } from '../core/store/GameStore.ts';
import { Firearm } from './Firearm.ts';

/**
 * 무기 시스템 매니저.
 * 플레이어의 무기를 관리하고 점수를 추적합니다.
 */
export class WeaponSystem {
  private weapons: IWeapon[] = [];
  private currentWeaponIndex = 0;
  public score = 0;

  constructor(
    scene: Scene,
    camera: UniversalCamera,
    targetManager: TargetManager,
    applyRecoil?: (force: number) => void
  ) {
    const scoreCallback = (points: number): void => this.addScore(points);

    this.weapons = [
      new Pistol(scene, camera, targetManager, scoreCallback, applyRecoil),
      new Rifle(scene, camera, targetManager, scoreCallback, applyRecoil),
      new Knife(scene, camera, targetManager, scoreCallback),
      new Bat(scene, camera, targetManager, scoreCallback),
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
    this.emitAmmoUpdate();
    this.emitScoreUpdate();
  }

  private emitAmmoUpdate(): void {
    // NanoStores 업데이트 (이제 HUD는 이 스토어를 구독합니다)
    // IFirearm 속성이 있는지 체크하여 탄약 UI 표시 여부 결정
    const firearm = this.currentWeapon as any;
    ammoStore.set({
      weaponName: this.currentWeapon.name,
      current: firearm.currentAmmo !== undefined ? firearm.currentAmmo : 0,
      reserve: firearm.reserveAmmo !== undefined ? firearm.reserveAmmo : 0,
      showAmmo: firearm.currentAmmo !== undefined,
    });
  }

  private emitScoreUpdate(): void {
    scoreStore.set(this.score);
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
        case 'Digit3':
          this.switchWeapon(2);
          break;
        case 'Digit4':
          this.switchWeapon(3);
          break;
        case 'KeyR':
          const gun = this.currentWeapon as any;
          if (gun.reload && typeof gun.reload === 'function') {
            gun.reload();
          }
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

    // 무기 교체 시 탄약 UI 업데이트
    this.emitAmmoUpdate();
  }

  /** 현재 활성화된 무기를 반환합니다. */
  public getCurrentWeapon(): IWeapon {
    return this.weapons[this.currentWeaponIndex];
  }

  private addScore(points: number): void {
    this.score += points;
    this.emitScoreUpdate();
  }

  public update(deltaTime: number): void {
    this.currentWeapon.update(deltaTime);
  }

  /** 현재 무기의 정조준 상태 설정 */
  public setAiming(isAiming: boolean): void {
    this.currentWeapon.setAiming(isAiming);
  }

  public get currentAmmo(): number {
    return this.currentWeapon instanceof Firearm ? this.currentWeapon.currentAmmo : 0;
  }

  public get reserveAmmo(): number {
    return this.currentWeapon instanceof Firearm ? this.currentWeapon.reserveAmmo : 0;
  }

  public get weaponStats(): Record<string, unknown> {
    return this.currentWeapon.getStats();
  }
}
