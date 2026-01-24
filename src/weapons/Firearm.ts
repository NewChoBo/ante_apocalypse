import { Scene, UniversalCamera, Ray, Vector3 } from '@babylonjs/core';
import { BaseWeapon } from './BaseWeapon.ts';
import { TargetRegistry } from '../core/systems/TargetRegistry';
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

  public getMovementSpeedMultiplier(): number {
    return this.isAiming ? 0.4 : 1.0;
  }

  public getDesiredFOV(defaultFOV: number): number {
    return this.isAiming ? 0.8 : defaultFOV;
  }

  protected applyRecoilCallback?: (force: number) => void;

  protected isReloading = false;
  protected lastFireTime = 0;
  protected isFiring = false;
  protected muzzleOffset = new Vector3(0, 0.1, 0.5);

  constructor(
    scene: Scene,
    camera: UniversalCamera,
    initialAmmo: number,
    reserveAmmo: number,
    onScore?: (points: number) => void,
    applyRecoil?: (force: number) => void
  ) {
    super(scene, camera, onScore);
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
      // 투명한 메쉬나 플레이어 자신 제외하고 모든 pickable 메쉬 허용
      return mesh.isPickable && mesh.isVisible && mesh.name !== 'playerPawn';
    });

    if (pickInfo?.hit && pickInfo.pickedMesh) {
      // 1. 공통 타격 이펙트 (벽, 바닥, 타겟 모두 포함)
      GameObservables.hitEffect.notifyObservers({
        position: pickInfo.pickedPoint!,
        normal: pickInfo.getNormal(true) || Vector3.Up(),
      });

      // 2. 타겟 처리 로직 (이름 확인)
      const meshName = pickInfo.pickedMesh.name;
      if (meshName.startsWith('target')) {
        const nameParts = meshName.split('_');
        const targetId = `${nameParts[0]}_${nameParts[1]}`;
        const part = nameParts[2] || 'body';

        const isHeadshot = part === 'head';
        const destroyed = TargetRegistry.getInstance().hitTarget(targetId, part, this.damage);

        if (this.onScoreCallback) {
          const score = destroyed ? (isHeadshot ? 200 : 100) : isHeadshot ? 30 : 10;
          this.onScoreCallback(score);
        }

        GameObservables.targetHit.notifyObservers({
          targetId,
          part,
          damage: this.damage,
          position: pickInfo.pickedPoint!,
        });
      }
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
