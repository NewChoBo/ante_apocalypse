import { WeaponSystem } from '../weapons/WeaponSystem';

export class HUD {
  private weaponSystem: WeaponSystem;

  private scoreElement: HTMLElement;
  private currentAmmoElement: HTMLElement;
  private totalAmmoElement: HTMLElement;

  constructor(weaponSystem: WeaponSystem) {
    this.weaponSystem = weaponSystem;

    this.scoreElement = document.getElementById('score')!;
    this.currentAmmoElement = document.getElementById('current-ammo')!;
    this.totalAmmoElement = document.getElementById('total-ammo')!;
  }

  public update(): void {
    this.scoreElement.textContent = this.weaponSystem.score.toString();
    this.currentAmmoElement.textContent = this.weaponSystem.currentAmmo.toString();
    this.totalAmmoElement.textContent = this.weaponSystem.reserveAmmo.toString();
  }
}
