import {
  Scene,
  UniversalCamera,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  AbstractMesh,
} from '@babylonjs/core';
import { Firearm as CoreFirearm } from '@ante/game-core';
import { GameObservables } from '../core/events/GameObservables';
import { ammoStore } from '../core/store/GameStore';
import { MuzzleTransform, IFirearm } from '../types/IWeapon';
import { HitScanSystem, DamageSystem } from '@ante/game-core';
import { WeaponVisualController } from './WeaponVisualController';
import type { GameContext } from '../types/GameContext';

/**
 * 총기류(Firearms)를 위한 중간 추상 클래스.
 * 탄약 관리, 재장전, 레이캐스트 사격 로직을 포함합니다.
 */
export abstract class Firearm extends CoreFirearm implements IFirearm {
  public abstract firingMode: 'semi' | 'auto';
  public abstract recoilForce: number;

  // Visual controller (composition pattern)
  protected visualController: WeaponVisualController;

  // IWeapon properties
  public name: string = '';
  public damage: number = 0;
  public range: number = 0;

  // Expose visual controller properties for backward compatibility
  public get scene(): Scene {
    return this.visualController.scene;
  }

  public get camera(): UniversalCamera {
    return this.visualController.camera;
  }

  public get weaponMesh(): AbstractMesh | null {
    return this.visualController.weaponMesh;
  }

  public set weaponMesh(mesh: AbstractMesh | null) {
    this.visualController.weaponMesh = mesh;
  }

  public get isActive(): boolean {
    return this.visualController.isActive;
  }

  public get isAiming(): boolean {
    return this.visualController.isAiming;
  }

  public getMovementSpeedMultiplier(): number {
    return this.isAiming ? 0.4 : 1.0;
  }

  public getDesiredFOV(defaultFOV: number): number {
    return this.isAiming ? 0.8 : defaultFOV;
  }

  protected ctx: GameContext;
  protected applyRecoilCallback?: (force: number) => void;

  protected isFiring = false;
  protected muzzleOffset = new Vector3(0, 0.1, 0.5);

  constructor(
    context: GameContext,
    initialAmmo: number,
    reserveAmmo: number,
    applyRecoil?: (force: number) => void
  ) {
    // Pass dummy stats to core, subclasses should initialize proper stats or we update them here
    super('firearm', 'player_local', {
      name: 'Firearm',
      damage: 0,
      range: 100,
      magazineSize: 0,
      fireRate: 0.1,
      reloadTime: 1.0,
    });

    this.ctx = context;

    // Initialize visual controller with stopFire callback
    this.visualController = new WeaponVisualController(context, () => this.stopFire());

    // Manual setup for client-side legacy compatibility (until subclasses fully move to stats)
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

    // 모델이 없을 경우 치메라 위치 기준 (월드 좌표)
    const pos = this.camera.globalPosition.add(forward.scale(0.8));
    return { position: pos, direction: forward };
  }

  public fire(): boolean {
    // Core logic check (ammo, fire rate, reload state)
    // Note: Mixin 'fire' is not defined, we must implement it here or rely on Core's fireLogic
    // Core has 'canFire'
    if (!this.canFire) return false;

    // Execute logic (ammo decrement)
    if (!super.fireLogic()) return false;

    this.onFire();

    // 발사 이벤트 발행
    GameObservables.weaponFire.notifyObservers({
      weaponId: this.name,
      ownerId: this.ownerId,
      ammoRemaining: this.currentAmmo,
      fireType: 'firearm',
      muzzleTransform: this.getMuzzleTransform(),
    });

    // 네트워크 발사 이벤트 전송
    const muzzle = this.getMuzzleTransform();
    this.ctx.networkManager.fire({
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

    // Start Core Reload (sets isReloading = true)
    super.reload();

    this.isFiring = false;
    this.onReloadStart();
    this.ejectMagazine();

    // Notify Server
    this.ctx.networkManager.reload(this.name);

    // Core handles the timer in tick(), but we can also hook into that or just keep visual logic here.
    // However, Core 'reloadLogic' is called when timer finishes.
    // We should override 'reloadLogic' to add our visual callbacks.
  }

  public override reloadLogic(): void {
    super.reloadLogic(); // Actual ammo transfer

    this.onReloadEnd();

    if (this.isActive) {
      this.updateAmmoStore();
    }
  }

  public update(deltaTime: number): void {
    super.tick(deltaTime); // Update Core logic (reload timer)
    this.visualController.updateAnimations(deltaTime);

    // 장전 중 연출 (기울기)
    if (this.weaponMesh) {
      const targetZ = this.isReloading
        ? this.visualController['idleRotation'].z + 0.6
        : this.visualController['idleRotation'].z;
      this.weaponMesh.rotation.z += (targetZ - this.weaponMesh.rotation.z) * deltaTime * 10;
    }

    // Auto-fire logic
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
      const part = targetMesh.metadata?.bodyPart || 'body';

      // Pawn 및 데미지 배율 추출 시도
      let targetId = targetMesh.metadata?.id || targetMesh.name;
      let finalDamage = this.damage;

      if (targetMesh.metadata?.pawn) {
        const pawn = targetMesh.metadata.pawn;
        targetId = pawn.id;

        // DamageSystem을 이용한 공통 데미지 계산 로직 적용
        finalDamage = DamageSystem.calculateDamage(this.damage, part, pawn.damageProfile);

        if (finalDamage > this.damage) {
          // Critical Hit!
        }
      }

      this.ctx.networkManager.requestHit({
        targetId,
        damage: finalDamage,
        weaponId: this.name,
        part: part,
        origin: { x: rayOrigin.x, y: rayOrigin.y, z: rayOrigin.z },
        direction: { x: direction.x, y: direction.y, z: direction.z },
      });

      // 3. 통합 히트 프로세싱 (로컬 연출 등)
      this.visualController.processHit(targetMesh, result.pickedPoint!, finalDamage);
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

  public updateStats(stats: Partial<Record<string, unknown>>): void {
    const isInitialSync = this.magazineSize === 0;

    // Update local properties
    if (stats.damage !== undefined) this.damage = stats.damage as number;
    if (stats.range !== undefined) this.range = stats.range as number;

    // Update Core stats
    const coreStats = this.stats as any;
    if (stats.damage !== undefined) coreStats.damage = stats.damage as number;
    if (stats.range !== undefined) coreStats.range = stats.range as number;
    if (stats.magazineSize !== undefined) coreStats.magazineSize = stats.magazineSize as number;
    if (stats.fireRate !== undefined) coreStats.fireRate = stats.fireRate as number;
    if (stats.reloadTime !== undefined) coreStats.reloadTime = stats.reloadTime as number;

    // [신규] 최초 동기화 시 탄약 자동 지급
    if (isInitialSync && (this.stats.magazineSize || 0) > 0) {
      this.currentAmmo = this.stats.magazineSize!;
      this.reserveAmmo = this.stats.magazineSize! * 5; // 소총 등 연사 무기를 위해 넉넉히 지급
    }

    // 탄약 관련 상태 동기화 (탄창 크기 변경 시 필요할 수 있음)
    if (this.isActive) {
      this.updateAmmoStore();
    }
  }

  // IWeapon methods - delegate to visual controller
  public show(): void {
    this.visualController.show();
  }

  public hide(): void {
    this.visualController.hide();
  }

  public setAiming(isAiming: boolean): void {
    this.visualController.setAiming(isAiming);
  }

  public lower(): Promise<void> {
    return this.visualController.lower();
  }

  public raise(): void {
    this.visualController.raise();
  }

  public dispose(): void {
    this.visualController.dispose();
  }

  // Protected helper methods for subclasses
  public setIdleState(): void {
    this.visualController.setIdleState();
  }
}
