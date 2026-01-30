import { Scene, UniversalCamera, Vector3, Mesh } from '@babylonjs/core';
import { BaseWeapon } from './BaseWeapon';

/**
 * 근접 무기(Melee Weapons)를 위한 중간 추상 클래스.
 * 휘두르기 로직, 스테미너 소모, 충돌 판정 등을 구현할 예정입니다.
 */
export abstract class MeleeWeapon extends BaseWeapon {
  protected isSwinging = false;
  protected lastSwingTime = 0;

  public getMovementSpeedMultiplier(): number {
    return 1.0;
  }

  public getDesiredFOV(defaultFOV: number): number {
    return defaultFOV;
  }

  constructor(scene: Scene, camera: UniversalCamera, onScore?: (points: number) => void) {
    super(scene, camera, onScore);
  }

  /** 근접 무기 사용 */
  public fire(): boolean {
    return this.swing();
  }

  public abstract swing(): boolean;

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

  public update(deltaTime: number): void {
    this.updateAnimations(deltaTime);
  }

  public addAmmo(_amount: number): void {
    // 근접 무기는 탄약 없음
  }
}
