import * as THREE from 'three';

export interface WeaponConfig {
  name: string;
  maxAmmo: number;
  totalAmmo: number;
  reloadTime: number;
  recoilForce: number;
}

export abstract class BaseWeapon {
  public mesh: THREE.Group;
  protected config: WeaponConfig;
  
  public currentAmmo: number;
  public totalAmmo: number;
  public isReloading: boolean = false;

  protected recoilOffset = new THREE.Vector3();
  protected recoilRotation = 0;
  protected bobbingAmount = 0;
  protected bobbingSpeed = 0;

  constructor(config: WeaponConfig) {
    this.config = config;
    this.currentAmmo = config.maxAmmo;
    this.totalAmmo = config.totalAmmo;
    this.mesh = new THREE.Group();
  }

  public update(delta: number, isMoving: boolean): void {
    this.recoilOffset.lerp(new THREE.Vector3(0, 0, 0), delta * 10);
    this.recoilRotation *= (1 - delta * 15);

    if (isMoving) {
      this.bobbingSpeed += delta * 10;
      this.bobbingAmount = Math.sin(this.bobbingSpeed) * 0.015;
    } else {
      this.bobbingAmount *= (1 - delta * 5);
    }

    this.applyTransform();
  }

  protected abstract applyTransform(): void;

  public shoot(): boolean {
    if (this.isReloading || this.currentAmmo <= 0) return false;
    
    this.currentAmmo--;
    this.recoilOffset.z = 0.1;
    this.recoilRotation = -0.15;
    return true;
  }

  public abstract reload(onComplete: () => void): void;
}
