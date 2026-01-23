import { Scene, UniversalCamera, Ray, Vector3 } from '@babylonjs/core';
import { BaseWeapon } from './BaseWeapon.ts';
import { TargetManager } from '../targets/TargetManager.ts';
import { GameObservables } from '../core/events/GameObservables.ts';
import { ammoStore } from '../core/store/GameStore.ts';
import { IFirearm } from '../types/IWeapon.ts';

/**
 * 총기류(Firearms)를 위한 중간 추상 클래스.
 * 탄약 관리, 재장전, 레이캐스트 사격 로직을 포함합니다.
 */
export abstract class Firearm extends BaseWeapon implements IFirearm {
  public currentAmmo: number;
  public abstract magazineSize: number;
  public reserveAmmo: number;

  public abstract fireRate: number;
  public abstract reloadTime: number;
  public abstract firingMode: 'semi' | 'auto';
  public abstract recoilForce: number;

  protected applyRecoilCallback?: (force: number) => void;

  protected isReloading = false;
  protected lastFireTime = 0;
  protected isFiring = false;
  protected muzzleOffset = new Vector3(0, 0.1, 0.5);

  constructor(
    scene: Scene,
    camera: UniversalCamera,
    targetManager: TargetManager,
    initialAmmo: number,
    reserveAmmo: number,
    onScore?: (points: number) => void,
    applyRecoil?: (force: number) => void
  ) {
    super(scene, camera, targetManager, onScore);
    this.currentAmmo = initialAmmo;
    this.reserveAmmo = reserveAmmo;
    this.applyRecoilCallback = applyRecoil;
  }

  /** 총구 트랜스폼 정보 제공 (IMuzzleProvider 구현) */
  public getMuzzleTransform(): { position: Vector3; direction: Vector3; transformNode?: any } {
    const forward = this.camera.getForwardRay().direction;

    if (this.weaponMesh) {
      this.camera.computeWorldMatrix();
      this.weaponMesh.computeWorldMatrix();
      const worldPos = Vector3.TransformCoordinates(
        this.muzzleOffset,
        this.weaponMesh.getWorldMatrix()
      );

      return {
        position: worldPos,
        direction: forward,
        transformNode: this.weaponMesh,
      };
    }

    // 모델이 없을 경우 카메라 위치 기준 (월드 좌표)
    const pos = this.camera.globalPosition.add(forward.scale(0.8));
    return { position: pos, direction: forward };
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

    // 발사 이벤트 발행
    GameObservables.weaponFire.notifyObservers({
      weaponId: this.name,
      ammoRemaining: this.currentAmmo,
      fireType: 'firearm',
      muzzleTransform: this.getMuzzleTransform(),
    });

    // 자체 반동 처리
    if (this.applyRecoilCallback) {
      this.applyRecoilCallback(this.recoilForce);
    }

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

      // 히트 이벤트 발행 (WeaponEffectComponent에서 구독 가능하도록)
      GameObservables.targetHit.notifyObservers({
        targetId,
        part,
        damage: this.damage,
        position: pickInfo.pickedPoint!,
      });
    }
  }

  protected updateAmmoStore(): void {
    ammoStore.set({
      weaponName: this.name,
      current: this.currentAmmo,
      reserve: this.reserveAmmo,
      showAmmo: true,
    });
  }

  protected abstract onFire(): void;
  protected abstract onReloadStart(): void;
  protected abstract onReloadEnd(): void;

  public dispose(): void {
    super.dispose();
  }
}
