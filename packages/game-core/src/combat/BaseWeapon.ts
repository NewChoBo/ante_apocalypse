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
  public isReloading: boolean = false;
  protected lastFireTime: number = 0;

  constructor(id: string, ownerId: string) {
    this.id = id;
    this.ownerId = ownerId;
  }

  /**
   * 하위 클래스나 Mixin에서 스태츠 객체를 제공해야 합니다.
   */
  public abstract stats: any;

  public get canFire(): boolean {
    if (this.isReloading) return false;
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
}
