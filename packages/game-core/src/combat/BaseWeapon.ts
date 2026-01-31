import { WeaponStats } from '../weapons/WeaponRegistry';

/**
 * Core BaseWeapon: Handles pure logic (state, stats, cooldowns).
 * No rendering, audio, or physics dependencies.
 */
export abstract class BaseWeapon {
  // Config
  public id: string;
  public ownerId: string;
  public stats: WeaponStats;

  // State
  public currentAmmo: number = 0;
  public reserveAmmo: number = 0;
  public isReloading: boolean = false;
  protected lastFireTime: number = 0;

  constructor(id: string, ownerId: string, stats: WeaponStats) {
    this.id = id;
    this.ownerId = ownerId;
    this.stats = stats;
    this.currentAmmo = stats.magazineSize || 0;
  }

  public get canFire(): boolean {
    if (this.isReloading) return false;
    if (this.currentAmmo <= 0 && (this.stats.magazineSize || 0) > 0) return false;
    const now = Date.now() / 1000;
    if (this.stats.fireRate && now - this.lastFireTime < this.stats.fireRate) return false;
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
}
