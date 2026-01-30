import {
  Scene,
  UniversalCamera,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
} from '@babylonjs/core';
import { BaseWeapon } from './BaseWeapon';
import { GameObservables } from '../core/events/GameObservables';
import { ammoStore } from '../core/store/GameStore';
import { MuzzleTransform, IFirearm } from '../types/IWeapon';
import { NetworkManager } from '../core/systems/NetworkManager';
import { HitScanSystem } from '@ante/game-core';

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
    this.onFire();

    // 발사 이벤트 발행
    GameObservables.weaponFire.notifyObservers({
      weaponId: this.name,
      ammoRemaining: this.currentAmmo,
      fireType: 'firearm',
      muzzleTransform: this.getMuzzleTransform(),
    });

    // 네트워크 발사 이벤트 전송
    const muzzle = this.getMuzzleTransform();
    NetworkManager.getInstance().fire({
      weaponId: this.name,
      muzzleTransform: {
        position: { x: muzzle.position.x, y: muzzle.position.y, z: muzzle.position.z },
        direction: { x: muzzle.direction.x, y: muzzle.direction.y, z: muzzle.direction.z },
      },
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
    const rayOrigin = this.camera.globalPosition;
    const result = HitScanSystem.doRaycast(
      this.scene,
      rayOrigin,
      direction,
      this.range,
      (mesh) => mesh.name !== 'playerPawn'
    );

    if (result.hit && result.pickedMesh) {
      // 1. 공통 타격 이펙트 (반응성 확보)
      GameObservables.hitEffect.notifyObservers({
        position: result.pickedPoint!,
        normal: result.normal || Vector3.Up(),
      });

      // 2. 서버에 피격 요청 전송
      const targetMesh = result.pickedMesh;

      // 부위 감지 (metadata.bodyPart: 'head', 'body' 등)
      const hitPart = targetMesh.metadata?.bodyPart || 'body';

      // Pawn 및 데미지 배율 추출 시도
      let targetId = targetMesh.metadata?.id || targetMesh.name;
      let finalDamage = this.damage;

      if (targetMesh.metadata?.pawn) {
        const pawn = targetMesh.metadata.pawn;
        targetId = pawn.id;

        // 데미지 배율 적용
        if (pawn.damageProfile) {
          const multiplier =
            pawn.damageProfile.multipliers?.[hitPart] ??
            pawn.damageProfile.defaultMultiplier ??
            1.0;
          finalDamage = Math.floor(this.damage * multiplier);
          if (multiplier > 1.1) {
            console.log(
              `[Firearm] Critical Hit! Part: ${hitPart}, Multiplier: ${multiplier}, Final Damage: ${finalDamage}`
            );
          }
        }
      }

      NetworkManager.getInstance().requestHit({
        targetId,
        damage: finalDamage,
        weaponId: this.name,
        hitPart: hitPart,
      });

      // 3. 통합 히트 프로세싱 (로컬 연출 등)
      this.processHit(targetMesh, result.pickedPoint!, finalDamage);
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
