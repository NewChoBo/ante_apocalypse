import * as THREE from 'three';
import { BaseWeapon, WeaponConfig } from './BaseWeapon';

export class Pistol extends BaseWeapon {
  constructor() {
    const config: WeaponConfig = {
      name: 'Pistol',
      maxAmmo: 12,
      totalAmmo: 48,
      reloadTime: 1200,
      recoilForce: 0.1
    };
    super(config);
    this.createModel();
  }

  private createModel(): void {
    const bodyGeo = new THREE.BoxGeometry(0.1, 0.15, 0.4);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    this.mesh.add(body);

    const barrelGeo = new THREE.BoxGeometry(0.06, 0.06, 0.3);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.position.z = -0.25;
    this.mesh.add(barrel);

    const gripGeo = new THREE.BoxGeometry(0.08, 0.15, 0.08);
    const grip = new THREE.Mesh(gripGeo, bodyMat);
    grip.position.set(0, -0.12, 0.1);
    grip.rotation.x = Math.PI / 6;
    this.mesh.add(grip);
  }

  protected applyTransform(): void {
    this.mesh.position.set(0.5 + this.recoilOffset.x, -0.4 + this.recoilOffset.y + this.bobbingAmount, -0.8 + this.recoilOffset.z);
    this.mesh.rotation.x = this.recoilRotation;
  }

  public reload(onComplete: () => void): void {
    if (this.isReloading || this.currentAmmo >= this.config.maxAmmo || this.totalAmmo <= 0) return;

    this.isReloading = true;
    const originalY = this.mesh.position.y;
    this.mesh.position.y = -1.5;

    setTimeout(() => {
      const needed = this.config.maxAmmo - this.currentAmmo;
      const fill = Math.min(needed, this.totalAmmo);
      this.currentAmmo += fill;
      this.totalAmmo -= fill;
      this.isReloading = false;
      this.mesh.position.y = originalY;
      onComplete();
    }, this.config.reloadTime);
  }
}
