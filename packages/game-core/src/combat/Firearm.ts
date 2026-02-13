import { BaseWeapon } from './BaseWeapon';
import { WeaponStats } from '../weapons/WeaponRegistry';
import { WithStatSync, WithFSM } from '../utils/Mixins';

export type WeaponState = 'Ready' | 'Firing' | 'Reloading' | 'Empty';

/** 무기 상태 전이 규칙 정의 */
const FirearmTransitions: Record<WeaponState, WeaponState[]> = {
  Ready: ['Firing', 'Reloading', 'Empty'],
  Firing: ['Ready', 'Reloading', 'Empty'],
  Reloading: ['Ready'],
  Empty: ['Reloading'],
};

/**
 * Mixin을 적용한 Firearm 클래스.
 * FSM을 통해 무기의 상태(발사, 장전 등)를 엄격히 관리합니다.
 */
export class Firearm extends WithFSM(
  WithStatSync<typeof BaseWeapon, WeaponStats>(BaseWeapon),
  FirearmTransitions,
  'Ready'
) {
  public get magazineSize(): number {
    return this.stats.magazineSize || 0;
  }

  public get fireRate(): number {
    return this.stats.fireRate || 0.1;
  }

  public get reloadTime(): number {
    return this.stats.reloadTime || 1;
  }

  protected reloadTimer: number = 0;

  public stats: WeaponStats;

  constructor(id: string, ownerId: string, stats: WeaponStats) {
    super(id, ownerId);
    this.stats = stats;
    this.currentAmmo = stats.magazineSize || 0;

    // 초기 탄약 상태에 따른 상태 설정
    if (this.currentAmmo === 0 && this.magazineSize > 0) {
      this.transitionTo('Empty');
    }
  }

  /**
   * 장전을 시도합니다. FSM 규칙에 따라 상태가 변경됩니다.
   */
  public reload(): void {
    if (this.currentAmmo === this.magazineSize || this.reserveAmmo === 0) return;

    if (this.transitionTo('Reloading')) {
      this.reloadTimer = 0;
    }
  }

  /**
   * 장전 로직 완료 처리.
   */
  public reloadLogic(): void {
    const needed = this.magazineSize - this.currentAmmo;
    const amount = Math.min(needed, this.reserveAmmo);

    this.currentAmmo += amount;
    this.reserveAmmo -= amount;

    // 장전 완료 후 Ready 상태로 복귀
    this.transitionTo('Ready');
  }

  public override fireLogic(): boolean {
    // FSM 상태 확인 (Ready 또는 Firing 상태여야 함)
    if (this.currentState !== 'Ready' && this.currentState !== 'Firing') {
      return false;
    }

    if (super.fireLogic()) {
      if (this.currentAmmo <= 0) {
        this.transitionTo('Empty');
      } else {
        this.transitionTo('Firing');
      }
      return true;
    }
    return false;
  }

  public override tick(deltaTime: number): void {
    if (this.currentState === 'Reloading') {
      this.reloadTimer += deltaTime;
      if (this.reloadTimer >= this.reloadTime) {
        this.reloadLogic();
      }
    }

    // Firing 상태에서 일정 시간 후 Ready로 복귀하는 로직 등을 추가할 수 있음
    if (this.currentState === 'Firing') {
      const now = Date.now() / 1000;
      if (now - this.lastFireTime >= this.fireRate) {
        this.transitionTo('Ready');
      }
    }
  }
}
