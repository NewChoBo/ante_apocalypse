import { WeaponStats } from '@ante/common';

/**
 * Core BaseWeapon: Handles pure logic (state, cooldowns).
 * No rendering, audio, or physics dependencies.
 * Designed to be extended by Mixins like WithStatSync.
 */
export abstract class BaseWeapon {
  // Config
  public id: string;
  public ownerId: string;

  // State
  public currentAmmo: number = 0;
  public reserveAmmo: number = 0;
  protected lastFireTime: number = 0;

  constructor(id: string, ownerId: string) {
    this.id = id;
    this.ownerId = ownerId;
  }

  /**
   * 하위 클래스나 Mixin에서 스태츠 객체를 제공해야 합니다.
   */
  public abstract stats: WeaponStats;

  /**
   * 무기 발향 가능 여부. 하위 클래스(FSM 등)에서 상태에 따라 재정의합니다.
   */
  public get canFire(): boolean {
    const stats = this.stats;
    if (this.currentAmmo <= 0 && (stats.magazineSize || 0) > 0) return false;
    const now = Date.now() / 1000;
    if (stats.fireRate && now - this.lastFireTime < stats.fireRate) return false;
    return true;
  }

  /**
   * Pure logic for firing. Returns true if successful.
   * Decrements ammo, updates timestamp.
   */
  public fireLogic(): boolean {
    if (!this.canFire) return false;

    this.currentAmmo--;
    this.lastFireTime = Date.now() / 1000;
    return true;
  }

  public abstract reloadLogic(): void;

  public tick(_deltaTime: number): void {
    // Override in subclasses for timer logic
  }

  /**
   * 스태츠를 업데이트합니다. 컴포지션 아키텍처에서 Mixin의 updateStats 역할을 대체합니다.
   */
  public updateStats(stats: Partial<WeaponStats>): void {
    Object.assign(this.stats, stats);
    this.onStatsUpdated(stats);
  }

  /**
   * 스태츠 업데이트 직후의 사용자 로직을 위한 후처리 메서드.
   */
  protected onStatsUpdated(_stats: Partial<WeaponStats>): void {
    // Override in subclasses
  }
}
