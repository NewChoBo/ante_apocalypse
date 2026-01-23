import {
  Scene,
  UniversalCamera,
  Ray,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  PointLight,
} from '@babylonjs/core';
import { BaseWeapon } from './BaseWeapon.ts';
import { TargetManager } from '../targets/TargetManager.ts';
import { GameObservables } from '../core/events/GameObservables.ts';
import { ammoStore } from '../core/store/GameStore.ts';

/**
 * 총기류(Firearms)를 위한 중간 추상 클래스.
 * 탄약 관리, 재장전, 레이캐스트 사격 로직을 포함합니다.
 */
export abstract class Firearm extends BaseWeapon {
  public currentAmmo: number;
  public abstract magazineSize: number;
  public reserveAmmo: number;

  public abstract fireRate: number;
  public abstract reloadTime: number;
  public abstract firingMode: 'semi' | 'auto';

  protected isReloading = false;
  protected lastFireTime = 0;
  protected isFiring = false;
  protected muzzleOffset = new Vector3(0, 0.1, 0.5);

  // 성능 최적화 (깜빡임 방지)를 위한 재사용 자원
  private flashMaterial: StandardMaterial;
  private hitSparkMaterial: StandardMaterial;
  private muzzleLight: PointLight;

  constructor(
    scene: Scene,
    camera: UniversalCamera,
    targetManager: TargetManager,
    initialAmmo: number,
    reserveAmmo: number,
    onScore?: (points: number) => void
  ) {
    super(scene, camera, targetManager, onScore);
    this.currentAmmo = initialAmmo;
    this.reserveAmmo = reserveAmmo;

    // 자원 미리 생성 (첫 사격 시 셰이더 컴파일 지연 방지)
    this.flashMaterial = new StandardMaterial('muzzleFlashMat', this.scene);
    this.flashMaterial.emissiveColor = new Color3(1, 1, 0.6);
    this.flashMaterial.disableLighting = true;

    this.hitSparkMaterial = new StandardMaterial('hitSparkMat', this.scene);
    this.hitSparkMaterial.emissiveColor = new Color3(1, 0.8, 0.3);

    this.muzzleLight = new PointLight('muzzleLight', Vector3.Zero(), this.scene);
    this.muzzleLight.intensity = 0; // 초기 상태는 끔
    this.muzzleLight.range = 4;
    this.muzzleLight.diffuse = new Color3(1, 0.8, 0.4);
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

    // 반동 콜백 호출
    if (this.onFireCallback) {
      this.onFireCallback();
    }

    // 발사 이벤트 발행
    GameObservables.weaponFire.notifyObservers({
      weaponId: this.name,
      ammoRemaining: this.currentAmmo,
    });

    if (this.isActive) {
      this.updateAmmoStore();
    }

    if (this.currentAmmo <= 0 && this.reserveAmmo > 0) {
      this.reload();
    }

    return true;
  }

  public startFire(): void {
    if (this.firingMode === 'auto') {
      this.isFiring = true;
    } else {
      this.fire();
    }
  }

  public stopFire(): void {
    this.isFiring = false;
  }

  public reload(): void {
    if (this.isReloading || this.currentAmmo === this.magazineSize || this.reserveAmmo === 0) {
      return;
    }

    this.isReloading = true;
    this.isFiring = false;
    this.onReloadStart();

    setTimeout(() => {
      const needed = this.magazineSize - this.currentAmmo;
      const amount = Math.min(needed, this.reserveAmmo);

      this.currentAmmo += amount;
      this.reserveAmmo -= amount;
      this.isReloading = false;

      this.onReloadEnd();

      if (this.isActive) {
        this.updateAmmoStore();
      }
    }, this.reloadTime * 1000);
  }

  public update(_deltaTime: number): void {
    if (this.isFiring && this.firingMode === 'auto') {
      this.fire();
    }
  }

  public getStats(): Record<string, unknown> {
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

  protected performRaycast(): void {
    const forwardRay = this.camera.getForwardRay(this.range);

    // 탄 퍼짐 계산 (정조준 시 감소)
    const spread = this.isAiming ? 0.01 : 0.05;
    const randomSpread = new Vector3(
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread
    );

    const direction = forwardRay.direction.add(randomSpread).normalize();
    const ray = new Ray(this.camera.globalPosition, direction, this.range);

    const pickInfo = this.scene.pickWithRay(ray, (mesh) => {
      return mesh.isPickable && mesh.name.startsWith('target');
    });

    if (pickInfo?.hit && pickInfo.pickedMesh) {
      const meshName = pickInfo.pickedMesh.name;
      const nameParts = meshName.split('_');
      const targetId = `${nameParts[0]}_${nameParts[1]}`;
      const part = nameParts[2] || 'body';

      const isHeadshot = part === 'head';
      const destroyed = this.targetManager.hitTarget(targetId, part, this.damage);

      if (this.onScoreCallback) {
        const score = destroyed ? (isHeadshot ? 200 : 100) : isHeadshot ? 30 : 10;
        this.onScoreCallback(score);
      }

      this.createHitEffect(pickInfo.pickedPoint!);
    }
  }

  protected createHitEffect(position: Vector3): void {
    const spark = MeshBuilder.CreateSphere('hitSpark', { diameter: 0.05 }, this.scene);
    spark.position = position;
    spark.material = this.hitSparkMaterial;

    setTimeout(() => spark.dispose(), 80);
  }

  protected updateAmmoStore(): void {
    ammoStore.set({
      weaponName: this.name,
      current: this.currentAmmo,
      reserve: this.reserveAmmo,
    });
  }

  protected abstract onFire(): void;

  /** 총구 화염 효과 생성 */
  protected createMuzzleFlash(): void {
    const flash = MeshBuilder.CreateSphere('muzzleFlash', { diameter: 0.15 }, this.scene);
    flash.isPickable = false;
    flash.material = this.flashMaterial;

    if (this.weaponMesh) {
      flash.parent = this.camera;
      flash.position = this.weaponMesh.position.add(this.muzzleOffset);
    } else {
      const forward = this.camera.getForwardRay(1).direction;
      flash.position = this.camera.globalPosition.add(forward.scale(1.0));
    }

    // 미리 생성해둔 조명 켜기 및 위치 이동
    flash.computeWorldMatrix(true);
    this.muzzleLight.position.copyFrom(flash.absolutePosition);
    this.muzzleLight.intensity = 0.8;

    setTimeout(() => {
      flash.dispose();
      this.muzzleLight.intensity = 0;
    }, 60);
  }

  protected abstract onReloadStart(): void;
  protected abstract onReloadEnd(): void;

  public dispose(): void {
    super.dispose();
    if (this.flashMaterial) this.flashMaterial.dispose();
    if (this.hitSparkMaterial) this.hitSparkMaterial.dispose();
    if (this.muzzleLight) this.muzzleLight.dispose();
  }
}
