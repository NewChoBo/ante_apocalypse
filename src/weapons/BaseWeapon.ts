import { Scene, Mesh, UniversalCamera } from '@babylonjs/core';
import { IWeapon } from '../types/IWeapon.ts';
import { eventBus } from '../core/events/EventBus.ts';
import { GameEvents } from '../types/IEventBus.ts';

/**
 * 모든 무기의 공통 베이스 클래스.
 * 탄약 관리, 발사율, 데미지 등 기본 필드를 포함합니다.
 */
export abstract class BaseWeapon implements IWeapon {
  public abstract name: string;
  public currentAmmo: number;
  public abstract magazineSize: number;
  public reserveAmmo: number;

  // 무기 스탯
  public abstract damage: number;
  public abstract fireRate: number;
  public abstract range: number;
  public abstract reloadTime: number;
  public abstract firingMode: 'semi' | 'auto';

  protected scene: Scene;
  protected camera: UniversalCamera;
  protected isReloading = false;
  protected lastFireTime = 0;
  protected weaponMesh: Mesh | null = null;

  // 연발 상태
  protected isFiring = false;

  constructor(scene: Scene, camera: UniversalCamera, initialAmmo: number, reserveAmmo: number) {
    this.scene = scene;
    this.camera = camera;
    this.currentAmmo = initialAmmo;
    this.reserveAmmo = reserveAmmo;
  }

  public fire(): boolean {
    if (this.isReloading) return false;

    const now = performance.now() / 1000;
    if (now - this.lastFireTime < this.fireRate) return false;

    if (this.currentAmmo <= 0) {
      this.reload();
      return false;
    }

    this.currentAmmo--;
    this.lastFireTime = now;
    this.onFire();

    eventBus.emit(GameEvents.WEAPON_AMMO_CHANGED, {
      weaponId: this.name,
      current: this.currentAmmo,
      reserve: this.reserveAmmo,
    });

    if (this.currentAmmo <= 0 && this.reserveAmmo > 0) {
      this.reload();
    }

    return true;
  }

  /** 연발 시작 (auto 모드 전용) */
  public startFire(): void {
    if (this.firingMode === 'auto') {
      this.isFiring = true;
    } else {
      // semi 모드는 단발만
      this.fire();
    }
  }

  /** 연발 중지 */
  public stopFire(): void {
    this.isFiring = false;
  }

  public reload(): void {
    if (this.isReloading || this.currentAmmo === this.magazineSize || this.reserveAmmo === 0) {
      return;
    }

    this.isReloading = true;
    this.isFiring = false; // 재장전 시 연발 중지
    this.onReloadStart();

    setTimeout(() => {
      const needed = this.magazineSize - this.currentAmmo;
      const amount = Math.min(needed, this.reserveAmmo);

      this.currentAmmo += amount;
      this.reserveAmmo -= amount;
      this.isReloading = false;

      this.onReloadEnd();

      eventBus.emit(GameEvents.WEAPON_AMMO_CHANGED, {
        weaponId: this.name,
        current: this.currentAmmo,
        reserve: this.reserveAmmo,
      });
    }, this.reloadTime * 1000);
  }

  /** 매 프레임 업데이트 - 연발 처리 */
  public update(_deltaTime: number): void {
    if (this.isFiring && this.firingMode === 'auto') {
      this.fire();
    }
  }

  protected abstract onFire(): void;
  protected abstract onReloadStart(): void;
  protected abstract onReloadEnd(): void;

  public getStats(): any {
    return {
      name: this.name,
      damage: this.damage,
      fireRate: this.fireRate,
      magazineSize: this.magazineSize,
      reloadTime: this.reloadTime,
      range: this.range,
      firingMode: this.firingMode,
    };
  }

  public show(): void {
    if (this.weaponMesh) {
      this.weaponMesh.setEnabled(true);
    }
  }

  public hide(): void {
    this.stopFire();
    if (this.weaponMesh) {
      this.weaponMesh.setEnabled(false);
    }
  }

  public dispose(): void {
    this.isFiring = false;
    if (this.weaponMesh) {
      this.weaponMesh.dispose();
    }
  }
}
