import {
  Scene,
  UniversalCamera,
  Ray,
  Vector3,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
} from '@babylonjs/core';
import { BaseWeapon } from './BaseWeapon';
import { GameObservables } from '../core/events/GameObservables';
import { ammoStore } from '../core/store/GameStore';
import { MuzzleTransform, IFirearm } from '../types/IWeapon';
import { NetworkManager } from '../core/systems/NetworkManager';

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

    // --- 1. 레이 계산 (Origin + Spread) ---
    const rayOrigin = this.camera.globalPosition.clone();
    const forward = this.camera.getForwardRay().direction;
    const spread = this.isAiming ? 0.01 : 0.05;
    const randomSpread = new Vector3(
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread
    );
    const rayDirection = forward.add(randomSpread).normalize();

    // --- 2. 클라이언트 레이캐스트 (프록시 히트박스 + 월드 충돌) ---
    const ray = new Ray(rayOrigin, rayDirection, this.range);
    const pickInfo = this.scene.pickWithRay(ray, (mesh) => {
      // 1. 플레이어 자신 제외
      if (mesh.name === 'playerPawn') return false;

      // 2. 히트박스 혹은 일반 Pickable 메쉬(환경) 허용
      return mesh.isPickable && (mesh.metadata?.type === 'hitbox' || mesh.isVisible);
    });

    // 히트 정보 수집
    let hitInfo:
      | { targetId: string; bodyPart: string; point: { x: number; y: number; z: number } }
      | undefined;

    if (pickInfo?.hit && pickInfo.pickedMesh) {
      // 공통 타격 이펙트 (VFX)
      GameObservables.hitEffect.notifyObservers({
        position: pickInfo.pickedPoint!,
        normal: pickInfo.getNormal(true) || Vector3.Up(),
      });

      // 피격 대상 확인 (히트박스 메타데이터 사용)
      const meta = pickInfo.pickedMesh.metadata;
      if (meta && meta.type === 'hitbox') {
        const targetId = meta.targetId;
        const bodyPart = meta.bodyPart;
        hitInfo = {
          targetId,
          bodyPart,
          point: {
            x: pickInfo.pickedPoint!.x,
            y: pickInfo.pickedPoint!.y,
            z: pickInfo.pickedPoint!.z,
          },
        };
      }

      // 로컬 히트 처리 (VFX, 점수 등 - 서버 검증 후 최종 데미지 반영)
      this.processHit(pickInfo.pickedMesh as Mesh, pickInfo.pickedPoint!, this.damage);
    }

    // --- 3. 발사 연출 호출 (Recoil Animation 등) ---
    this.onFire();

    // 발사 이벤트 발행 (VFX 등)
    GameObservables.weaponFire.notifyObservers({
      weaponId: this.name,
      ammoRemaining: this.currentAmmo,
      fireType: 'firearm',
      muzzleTransform: this.getMuzzleTransform(),
    });

    // --- 4. 네트워크 전송 (판정 데이터 + HitInfo 포함) ---
    const muzzle = this.getMuzzleTransform();
    NetworkManager.getInstance().fire({
      weaponId: this.name,
      muzzleTransform: {
        position: { x: muzzle.position.x, y: muzzle.position.y, z: muzzle.position.z },
        direction: { x: muzzle.direction.x, y: muzzle.direction.y, z: muzzle.direction.z },
      },
      origin: { x: rayOrigin.x, y: rayOrigin.y, z: rayOrigin.z },
      direction: { x: rayDirection.x, y: rayDirection.y, z: rayDirection.z },
      hitInfo, // 클라이언트 판정 결과 전송
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
    this.ejectMagazine();

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

  // [DEPRECATED] performRaycast() is no longer used.
  // Raycasting is now performed inline in fire() and hitInfo is sent to the server.

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

  public override updateStats(stats: any): void {
    const isInitialSync = this.magazineSize === 0;

    super.updateStats(stats);
    if (stats.magazineSize !== undefined) this.magazineSize = stats.magazineSize;
    if (stats.fireRate !== undefined) this.fireRate = stats.fireRate;
    if (stats.reloadTime !== undefined) this.reloadTime = stats.reloadTime;

    // [신규] 최초 동기화 시 탄약 자동 지급
    if (isInitialSync && this.magazineSize > 0) {
      this.currentAmmo = this.magazineSize;
      this.reserveAmmo = this.magazineSize * 5; // 소총 등 연사 무기를 위해 넉넉히 지급
      console.log(
        `[Firearm] ${this.name} initialized with ${this.currentAmmo} / ${this.reserveAmmo} ammo`
      );
    }

    // 탄약 관련 상태 동기화 (탄창 크기 변경 시 필요할 수 있음)
    if (this.isActive) {
      this.updateAmmoStore();
    }
  }

  public dispose(): void {
    super.dispose();
  }
}
