import { BaseWeapon } from './BaseWeapon';
import { WeaponStats } from '../weapons/WeaponRegistry';

export class Firearm extends BaseWeapon {
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

  constructor(id: string, ownerId: string, stats: WeaponStats) {
    super(id, ownerId, stats);
  }

  public reload(): void {
    if (this.isReloading || this.currentAmmo === this.magazineSize || this.reserveAmmo === 0)
      return;

    this.isReloading = true;
    this.reloadTimer = 0;
  }

  public reloadLogic(): void {
    const needed = this.magazineSize - this.currentAmmo;
    const amount = Math.min(needed, this.reserveAmmo);

    this.currentAmmo += amount;
    this.reserveAmmo -= amount;
    this.isReloading = false;
  }

  public override tick(deltaTime: number): void {
    if (this.isReloading) {
      this.reloadTimer += deltaTime;
      if (this.reloadTimer >= this.reloadTime) {
        this.reloadLogic();
      }
    }
  }
}
