import { Scene, UniversalCamera, Vector3, Mesh } from '@babylonjs/core';
import { BaseWeapon } from './BaseWeapon';
import { GameObservables } from '../core/events/GameObservables';
import { MeleeWeaponConfig, toVector3 } from '../config/WeaponConfig';

/**
 * Abstract intermediate class for Melee Weapons.
 * Implements common swing logic, animation, and collision detection.
 */
export abstract class MeleeWeapon extends BaseWeapon {
  protected isSwinging = false;
  protected lastSwingTime = 0;

  // Animation state
  protected swingAnimationTimer = 0;
  protected isAnimating = false;
  protected defaultRotation = new Vector3(0, 0, 0);
  protected defaultPosition = new Vector3(0, 0, 0);

  // Weapon config
  protected abstract weaponConfig: MeleeWeaponConfig;

  public getMovementSpeedMultiplier(): number {
    return 1.0;
  }

  public getDesiredFOV(defaultFOV: number): number {
    return defaultFOV;
  }

  constructor(scene: Scene, camera: UniversalCamera) {
    super(scene, camera);
  }

  /**
   * Create mesh - called by subclasses
   * Uses ProceduralWeaponBuilder to create and configure mesh.
   */
  protected createMeshFromBuilder(builderFn: (scene: Scene) => Mesh | null): void {
    this.weaponMesh = builderFn(this.scene);

    if (this.weaponMesh) {
      this.weaponMesh.name = `${this.weaponConfig.name}Mesh_Proc`;
      this.weaponMesh.parent = this.camera;

      // Apply position/rotation from config
      this.weaponMesh.position = toVector3(this.weaponConfig.transform.position);
      this.weaponMesh.rotation = toVector3(this.weaponConfig.transform.rotation);

      this.weaponMesh.receiveShadows = true;

      // Store default state
      this.defaultPosition.copyFrom(this.weaponMesh.position);
      this.defaultRotation.copyFrom(this.weaponMesh.rotation);

      this.setIdleState();
      this.weaponMesh.setEnabled(false); // Start hidden
    }
  }

  /** Melee weapon use */
  public fire(): boolean {
    return this.swing();
  }

  public abstract swing(): boolean;

  /**
   * Start common swing logic
   */
  protected startSwing(): void {
    this.isSwinging = true;
    this.isAnimating = true;
    this.swingAnimationTimer = 0;

    // 발사 이벤트 발행 (사운드 및 HUD 연동용)
    GameObservables.weaponFire.notifyObservers({
      weaponId: this.name,
      ownerId: 'player_local',
      ammoRemaining: 0,
      fireType: 'melee',
    });

    // 공격 판정
    this.checkMeleeHit();

    // 애니메이션 종료 후 공격 가능 상태로 복귀
    setTimeout(() => {
      this.isSwinging = false;
    }, this.weaponConfig.animation.duration * 1000);
  }

  /**
   * Volume-based melee hit detection (Bounding Box distance and angle check)
   */
  protected checkMeleeHit(): { targetId: string; part: string; pickedPoint: Vector3 } | null {
    const camPos = this.camera.globalPosition;
    const camForward = this.camera.getForwardRay().direction;

    // 타겟 레지스트리 + 일반 적(메타데이터 체크) 모두 검색
    const allMeshes = this.scene.meshes;

    let closestHit: { mesh: Mesh; distance: number; point: Vector3 } | null = null;
    let minDistance = this.range;

    for (const mesh of allMeshes) {
      if (!mesh.isEnabled() || !mesh.isVisible || !mesh.isPickable) continue;
      if (mesh.name === 'playerPawn') continue;

      // Enemy 태그가 있거나, Target 이름으로 시작하는 메쉬만 대상으로 한다.
      const isEnemy = mesh.metadata && mesh.metadata.type === 'enemy';
      const isTarget = mesh.name.startsWith('target');

      if (!isEnemy && !isTarget) continue;

      mesh.computeWorldMatrix(true);
      const targetPos = mesh.absolutePosition;
      const distance = Vector3.Distance(camPos, targetPos);

      // 거리 체크 (두께 보정 +1.0)
      if (distance <= this.range + 1.0) {
        const toTarget = targetPos.subtract(camPos).normalize();
        const dot = Vector3.Dot(camForward, toTarget);

        // 공격 각도(전방) 및 거리 체크
        if (distance < 1.0 || dot > 0.3) {
          // 각도를 조금 더 좁힘 (0.1 -> 0.3) 정면 공격 유도
          if (distance < minDistance) {
            minDistance = distance;
            closestHit = {
              mesh: mesh as Mesh,
              distance: distance,
              point: targetPos,
            };
          }
        }
      }
    }

    if (closestHit) {
      // Apply damage via processHit
      this.processHit(closestHit.mesh, closestHit.point, this.damage);

      // Maintain return value format for backward compatibility
      return {
        targetId: closestHit.mesh.name,
        part: 'body',
        pickedPoint: closestHit.point,
      };
    }

    return null;
  }

  public startFire(): void {
    this.fire();
  }

  public stopFire(): void {
    // Melee weapons are typically single-hit
  }

  public getStats(): Record<string, unknown> {
    return {
      name: this.name,
      damage: this.damage,
      range: this.range,
    };
  }

  /**
   * Common animation update
   */
  public update(deltaTime: number): void {
    this.updateAnimations(deltaTime);

    if (this.isAnimating && this.weaponMesh) {
      this.swingAnimationTimer += deltaTime;

      const animConfig = this.weaponConfig.animation;
      const duration = animConfig.duration;
      const t = this.swingAnimationTimer / duration;

      if (t < 1.0) {
        // Swing animation
        const swingAngle = Math.sin(t * Math.PI) * animConfig.swingAngle;
        const forwardOffset = Math.sin(t * Math.PI) * animConfig.forwardOffset;

        // Apply different rotation axes per weapon
        if (animConfig.zRotationOffset !== undefined) {
          // Bat style: Z-axis rotation
          this.weaponMesh.rotation.z =
            this.defaultRotation.z - swingAngle * animConfig.zRotationOffset;
          if (animConfig.xRotationOffset !== undefined) {
            this.weaponMesh.rotation.x =
              this.defaultRotation.x + swingAngle * animConfig.xRotationOffset;
          }
        } else {
          // Knife style: X-axis rotation
          this.weaponMesh.rotation.x = this.defaultRotation.x + swingAngle;
          this.weaponMesh.position.z = this.defaultPosition.z + forwardOffset;
        }
      } else {
        // Animation end - reset to original position
        this.isAnimating = false;
        this.weaponMesh.rotation.copyFrom(this.defaultRotation);
        this.weaponMesh.position.copyFrom(this.defaultPosition);
      }
    }
  }

  public addAmmo(_amount: number): void {
    // 근접 무기는 탄약 없음
  }

  // Melee weapons don't need reload logic
  public reloadLogic(): void {
    // No-op for melee weapons
  }
}
