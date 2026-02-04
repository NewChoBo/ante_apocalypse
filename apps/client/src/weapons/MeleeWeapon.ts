import { Scene, UniversalCamera, Vector3, Mesh } from '@babylonjs/core';
import { BaseWeapon } from './BaseWeapon';
import { GameObservables } from '../core/events/GameObservables';
import { MeleeWeaponConfig, toVector3 } from '../config/WeaponConfig';
import { INetworkManager } from '../core/interfaces/INetworkManager';
import { WorldEntityManager } from '../core/systems/WorldEntityManager';

/**
 * 근접 무기(Melee Weapons)를 위한 중간 추상 클래스.
 * 공통된 휘두르기 로직, 애니메이션, 충돌 판정 등을 구현합니다.
 */
export abstract class MeleeWeapon extends BaseWeapon {
  protected isSwinging = false;
  protected lastSwingTime = 0;

  // 애니메이션 상태
  protected swingAnimationTimer = 0;
  protected isAnimating = false;
  protected defaultRotation = new Vector3(0, 0, 0);
  protected defaultPosition = new Vector3(0, 0, 0);

  // 무기 설정
  protected abstract weaponConfig: MeleeWeaponConfig;

  public getMovementSpeedMultiplier(): number {
    return 1.0;
  }

  public getDesiredFOV(defaultFOV: number): number {
    return defaultFOV;
  }

  constructor(
    scene: Scene,
    camera: UniversalCamera,
    networkManager: INetworkManager,
    worldManager: WorldEntityManager
  ) {
    super(scene, camera, networkManager, worldManager);
  }

  /**
   * 메시 생성 - 하위 클래스에서 호출
   * ProceduralWeaponBuilder를 사용하여 메시를 생성하고 설정합니다.
   */
  protected createMeshFromBuilder(builderFn: (scene: Scene) => Mesh | null): void {
    this.weaponMesh = builderFn(this.scene);

    if (this.weaponMesh) {
      this.weaponMesh.name = `${this.weaponConfig.name}Mesh_Proc`;
      this.weaponMesh.parent = this.camera;

      // 설정에서 위치/회전 적용
      this.weaponMesh.position = toVector3(this.weaponConfig.transform.position);
      this.weaponMesh.rotation = toVector3(this.weaponConfig.transform.rotation);

      this.weaponMesh.receiveShadows = true;

      // 기본 상태 저장
      this.defaultPosition.copyFrom(this.weaponMesh.position);
      this.defaultRotation.copyFrom(this.weaponMesh.rotation);

      this.setIdleState();
      this.weaponMesh.setEnabled(false); // Start hidden
    }
  }

  /** 근접 무기 사용 */
  public fire(): boolean {
    return this.swing();
  }

  public abstract swing(): boolean;

  /**
   * 공통 휘두르기 로직 시작
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
   * 볼륨 기반 근접 공격 판정 (Bounding Box 거리 및 각도 체크)
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
      // processHit 호출하여 데미지 적용
      this.processHit(closestHit.mesh, closestHit.point, this.damage);

      // 하위 호환성을 위해 리턴값 형식 유지 (필요하다면)
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
    // 근접 무기는 보통 단발적임
  }

  public getStats(): Record<string, unknown> {
    return {
      name: this.name,
      damage: this.damage,
      range: this.range,
    };
  }

  /**
   * 공통 애니메이션 업데이트
   */
  public update(deltaTime: number): void {
    this.updateAnimations(deltaTime);

    if (this.isAnimating && this.weaponMesh) {
      this.swingAnimationTimer += deltaTime;

      const animConfig = this.weaponConfig.animation;
      const duration = animConfig.duration;
      const t = this.swingAnimationTimer / duration;

      if (t < 1.0) {
        // 휘두르기 애니메이션
        const swingAngle = Math.sin(t * Math.PI) * animConfig.swingAngle;
        const forwardOffset = Math.sin(t * Math.PI) * animConfig.forwardOffset;

        // 무기별로 다른 회전 축 적용
        if (animConfig.zRotationOffset !== undefined) {
          // Bat 스타일: Z축 회전 위주
          this.weaponMesh.rotation.z =
            this.defaultRotation.z - swingAngle * animConfig.zRotationOffset;
          if (animConfig.xRotationOffset !== undefined) {
            this.weaponMesh.rotation.x =
              this.defaultRotation.x + swingAngle * animConfig.xRotationOffset;
          }
        } else {
          // Knife 스타일: X축 회전
          this.weaponMesh.rotation.x = this.defaultRotation.x + swingAngle;
          this.weaponMesh.position.z = this.defaultPosition.z + forwardOffset;
        }
      } else {
        // 애니메이션 종료 - 원위치
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
