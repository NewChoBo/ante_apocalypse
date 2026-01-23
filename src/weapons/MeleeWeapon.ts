import { Scene, UniversalCamera, Vector3 } from '@babylonjs/core';
import { BaseWeapon } from './BaseWeapon.ts';
import { TargetRegistry } from '../core/systems/TargetRegistry';

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
    // 카메라의 월드 포지션 가져오기 (부모가 있을 경우 position은 로컬좌표이므로 absolutePosition 사용)
    const camPos = this.camera.globalPosition;
    const camForward = this.camera.getForwardRay().direction;
    const targets = TargetRegistry.getInstance().getAllTargets();

    let closestTarget: { targetId: string; part: string; pickedPoint: Vector3 } | null = null;
    let minDistance = this.range;

    for (const target of targets) {
      if (!target.mesh) continue;

      // 월드 행렬 강제 업데이트 (정밀한 위치 보정)
      target.mesh.computeWorldMatrix(true);
      const targetPos = target.mesh.absolutePosition;

      // 메쉬의 중심과의 거리 (피벗 기준)
      const distance = Vector3.Distance(camPos, targetPos);

      // 타겟이 충분히 가깝다면 (사거리 보정 포함 - 히트박스 두께를 고려하여 +1.0m 보정)
      if (distance <= this.range + 1.0) {
        // 방향 체크 (카메라 전방 90도 이내로 넉넉하게)
        const toTarget = targetPos.subtract(camPos).normalize();
        const dot = Vector3.Dot(camForward, toTarget);

        // 1. 거리가 매우 가깝거나 (범위 내 인접) 2. 전방 각도 안에 있으면 히트 인정
        if (distance < 1.0 || dot > 0.1) {
          if (distance < minDistance) {
            minDistance = distance;
            closestTarget = {
              targetId: target.id,
              part: 'body',
              pickedPoint: targetPos,
            };
          }
        }
      }
    }

    return closestTarget;
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

  public update(_deltaTime: number): void {
    // 애니메이션 업데이트 등
  }
}
