import {
  Scene,
  UniversalCamera,
  Ray,
  Vector3,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Animation,
  Observable,
} from '@babylonjs/core';
import { BaseWeapon } from './BaseWeapon';

import { ammoStore } from '../core/store/GameStore';
import { MuzzleTransform, IFirearm, IWeapon } from '../types/IWeapon';
import { NetworkManager } from '../core/network/NetworkManager';
import { ReqHitPayload, ReqFirePayload, EventCode } from '../core/network/NetworkProtocol';
import { GameAssets } from '../core/loaders/AssetLoader';
import { WeaponUtils } from '../utils/WeaponUtils';

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

    // Listen for server-authoritative ammo updates
    NetworkManager.getInstance().onAmmoSynced.add((data) => {
      if (data.weaponId === this.name) {
        this.currentAmmo = data.currentAmmo;
        this.reserveAmmo = data.reserveAmmo;
        if (this.isActive) {
          this.updateAmmoStore();
        }
      }
    });
  }

  /** 총구 트랜스폼 정보 제공 (IMuzzleProvider 구현) */
  public getMuzzleTransform(): MuzzleTransform {
    const forward = this.camera.getForwardRay().direction;

    if (this.weaponMesh) {
      this.camera.computeWorldMatrix();
      this.weaponMesh.computeWorldMatrix(true);
      const worldPos = Vector3.TransformCoordinates(
        this.muzzleOffset,
        this.weaponMesh.getWorldMatrix()
      );

      return {
        position: worldPos,
        direction: forward,
        transformNode: this.weaponMesh,
        localMuzzlePosition: this.muzzleOffset.clone(),
      };
    }

    // 모델이 없을 경우 카메라 위치 기준 (월드 좌표)
    const pos = this.camera.globalPosition.add(forward.scale(0.8));
    return { position: pos, direction: forward };
  }

  public onFirePredicted = new Observable<IWeapon>();
  public onHitPredicted = new Observable<{ position: Vector3; normal: Vector3 }>();

  public fire(): boolean {
    if (this.isReloading) return false;

    const now = performance.now() / 1000;
    if (now - this.lastFireTime < this.fireRate) return false;

    // [Server Authority] Do not decrement ammo locally. Wait for ON_AMMO_SYNC.
    if (this.currentAmmo <= 0) {
      this.reload();
      return false;
    }

    this.lastFireTime = now;
    this.onFire();

    // [Prediction] Client-side visual/audio effect
    this.onFirePredicted.notifyObservers(this);

    // [Authority] Send Fire Request to Master Client
    const muzzle = this.getMuzzleTransform();
    const req = new ReqFirePayload(this.name, {
      position: { x: muzzle.position.x, y: muzzle.position.y, z: muzzle.position.z },
      direction: { x: muzzle.direction.x, y: muzzle.direction.y, z: muzzle.direction.z },
    });
    NetworkManager.getInstance().requestFire(req);

    // 자체 반동 처리
    if (this.applyRecoilCallback) {
      this.applyRecoilCallback(this.recoilForce);
    }

    if (this.isActive) {
      this.updateAmmoStore();
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

    // 1. Prediction/Visual feedback (Optional: start reload animation)
    this.isReloading = true;
    this.isFiring = false;
    this.onReloadStart();
    this.ejectMagazine();

    // 2. [Authority] Send Reload Request to Master Client
    const req = { weaponId: this.name }; // ReqReloadPayload matches this record/class
    NetworkManager.getInstance().sendEvent(EventCode.REQ_RELOAD, req, true);

    // 3. Local Timer to end "Reloading" state (Estimated time)
    // Server will eventually send ON_AMMO_SYNC which tells us exact new state.
    setTimeout(() => {
      this.isReloading = false;
      this.onReloadEnd();

      if (this.isActive) {
        this.updateAmmoStore();
      }
    }, this.reloadTime * 1000);
  }

  public update(deltaTime: number): void {
    this.updateAnimations(deltaTime);

    // 장전 중 연출 (기울기)
    if (this.weaponMesh) {
      const targetZ = this.isReloading ? this.idleRotation.z + 0.6 : this.idleRotation.z;
      this.weaponMesh.rotation.z += (targetZ - this.weaponMesh.rotation.z) * deltaTime * 10;
    }

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
      // 1. [Prediction] 공통 타격 이펙트 (벽, 바닥, 타겟 모두 포함)
      // Play hit effect immediately for responsiveness via Local Prediction
      this.onHitPredicted.notifyObservers({
        position: pickInfo.pickedPoint!,
        normal: pickInfo.getNormal(true) || Vector3.Up(),
      });

      // 2. [Authority] Send Hit Request to Master Client
      // Do NOT apply damage locally. Wait for CONFIRM_HIT or Entity Update.
      if (pickInfo.pickedMesh) {
        // Identify target ID using metadata (pawn or direct id)
        const metadata = pickInfo.pickedMesh.metadata;
        let targetId = pickInfo.pickedMesh.name;

        if (metadata) {
          if (metadata.pawn && metadata.pawn.id) {
            targetId = metadata.pawn.id;
          } else if (metadata.id) {
            targetId = metadata.id;
          }
        }

        const hitReq = new ReqHitPayload(targetId, this.damage, {
          x: pickInfo.pickedPoint!.x,
          y: pickInfo.pickedPoint!.y,
          z: pickInfo.pickedPoint!.z,
        });
        NetworkManager.getInstance().requestHit(hitReq);
      }

      // Removed direct processHit call
      // this.processHit(pickInfo.pickedMesh as Mesh, pickInfo.pickedPoint!, this.damage);
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

  protected ejectMagazine(): void {
    if (!this.weaponMesh) return;

    // 현재 총의 위치와 회전 가져오기
    const worldMatrix = this.weaponMesh.getWorldMatrix();
    const position = Vector3.TransformCoordinates(new Vector3(0, -0.1, 0), worldMatrix);

    const mag = MeshBuilder.CreateBox(
      'mag_eject',
      { width: 0.04, height: 0.08, depth: 0.04 },
      this.scene
    );
    mag.position.copyFrom(position);

    const material = new StandardMaterial('magMat', this.scene);
    material.diffuseColor = new Color3(0.1, 0.1, 0.1);
    mag.material = material;

    // 물리적 효과 시뮬레이션 (간단하게 관성 적용)
    const velocity = new Vector3(0, -0.05, 0);
    const gravity = -0.01;
    let lifetime = 60; // 약 1초 (60프레임)

    const observer = this.scene.onBeforeRenderObservable.add(() => {
      velocity.y += gravity;
      mag.position.addInPlace(velocity);
      mag.rotation.x += 0.1;
      mag.rotation.z += 0.05;

      lifetime--;
      if (lifetime <= 0) {
        this.scene.onBeforeRenderObservable.remove(observer);
        mag.dispose();
      }
    });
  }

  protected abstract onFire(): void;
  protected abstract onReloadStart(): void;
  protected abstract onReloadEnd(): void;

  public addAmmo(amount: number): void {
    this.reserveAmmo += amount;
    if (this.isActive) {
      this.updateAmmoStore();
    }
  }

  protected async instantiateWeaponModel(
    assetName: keyof GameAssets,
    targetSize: number,
    position: Vector3,
    rotation: Vector3,
    scalingZMultiplier: number = 1.0,
    materialTinter?: (mesh: Mesh) => void
  ): Promise<void> {
    const mesh = await WeaponUtils.createWeaponMesh(this.scene, {
      assetName,
      targetSize,
      parent: this.camera,
      position,
      rotation,
      scalingZMultiplier,
      materialTinter,
      isPickable: false,
      receiveShadows: true,
    });

    if (mesh) {
      this.weaponMesh = mesh;
      this.weaponMesh.setEnabled(this.isActive);
      this.setIdleState();
      console.log(`[${this.name}] Instantiated via WeaponUtils.`);
    }
  }

  protected playRecoilAnimation(intensity: number, duration: number, peakFrame: number = 2): void {
    if (!this.weaponMesh) return;

    const recoilAnim = new Animation(
      'recoil',
      'rotation.x',
      60,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    recoilAnim.setKeys([
      { frame: 0, value: 0 },
      { frame: peakFrame, value: intensity },
      { frame: duration, value: 0 },
    ]);

    this.weaponMesh.animations = [recoilAnim];
    this.scene.beginAnimation(this.weaponMesh, 0, duration, false);
  }

  public dispose(): void {
    super.dispose();
  }
}
