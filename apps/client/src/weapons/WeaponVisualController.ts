import { Scene, UniversalCamera, Vector3, AbstractMesh, Mesh } from '@babylonjs/core';
import { GameObservables } from '../core/events/GameObservables';
import type { GameContext } from '../types/GameContext';

/**
 * 무기의 시각적 기능을 담당하는 컨트롤러 클래스.
 * Mixin 패턴을 대체하는 컴포지션 패턴 구현.
 */
export class WeaponVisualController {
  // Visual State
  public weaponMesh: AbstractMesh | null = null;
  private ctx: GameContext;

  // Callback for stopping fire when hiding weapon
  private onStopFireCallback: (() => void) | null = null;

  public isActive = false;
  public isAiming = false;

  // Animation State
  protected visualOffset = new Vector3(0, 0, 0);
  protected visualRotation = new Vector3(0, 0, 0);
  protected animState: 'idle' | 'lowering' | 'raising' = 'idle';
  protected animProgress = 1;
  protected animSpeed = 5.0;
  protected idlePosition = new Vector3(0, 0, 0);
  protected idleRotation = new Vector3(0, 0, 0);

  public get scene(): Scene {
    return this.ctx.scene;
  }

  public get camera(): UniversalCamera {
    return this.ctx.camera;
  }

  constructor(context: GameContext, onStopFire?: () => void) {
    this.ctx = context;
    this.onStopFireCallback = onStopFire || null;
  }

  /**
   * 무기 메시 설정
   */
  public setWeaponMesh(mesh: AbstractMesh | null): void {
    this.weaponMesh = mesh;
    if (mesh) {
      this.setIdleState();
    }
  }

  /**
   * 현재 idle 상태 저장
   */
  public setIdleState(): void {
    if (this.weaponMesh) {
      this.idlePosition.copyFrom(this.weaponMesh.position);
      this.idleRotation.copyFrom(this.weaponMesh.rotation);
    }
  }

  /**
   * 이동 속도 배율 반환 (기본값)
   * 하위 클래스에서 오버라이드 가능
   */
  public getMovementSpeedMultiplier(): number {
    return 1.0;
  }

  /**
   * FOV 조정값 반환 (기본값)
   * 하위 클래스에서 오버라이드 가능
   */
  public getDesiredFOV(defaultFOV: number): number {
    return defaultFOV;
  }

  public getIdleRotationZ(): number {
    return this.idleRotation.z;
  }

  /**
   * 무기 표시
   */
  public show(): void {
    this.isActive = true;
    if (this.weaponMesh) {
      this.weaponMesh.setEnabled(true);
    }
  }

  /**
   * 무기 숨기기
   */
  public hide(): void {
    this.isActive = false;
    // stopFire 콜백 호출
    if (this.onStopFireCallback) {
      this.onStopFireCallback();
    }
    if (this.weaponMesh) {
      this.weaponMesh.setEnabled(false);
    }
  }

  /**
   * 조준 상태 설정
   */
  public setAiming(isAiming: boolean): void {
    this.isAiming = isAiming;
  }

  /**
   * 무기 내리기 애니메이션
   */
  public async lower(): Promise<void> {
    if (this.animState === 'lowering') return;
    this.animState = 'lowering';
    return new Promise((resolve) => {
      const check = (): void => {
        if (this.animProgress <= 0) {
          this.animState = 'idle';
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
  }

  /**
   * 무기 올리기 애니메이션
   */
  public raise(): void {
    this.animState = 'raising';
    this.animProgress = 0;
    this.show();
  }

  /**
   * 애니메이션 업데이트
   */
  public updateAnimations(deltaTime: number): void {
    if (this.animState === 'lowering') {
      this.animProgress = Math.max(0, this.animProgress - deltaTime * this.animSpeed);
    } else if (this.animState === 'raising') {
      this.animProgress = Math.min(1, this.animProgress + deltaTime * this.animSpeed);
      if (this.animProgress >= 1) {
        this.animState = 'idle';
      }
    }

    if (this.weaponMesh) {
      const yOffset = (this.animProgress - 1) * 0.5;
      this.weaponMesh.position.y = this.idlePosition.y + yOffset;

      const xRot = (1 - this.animProgress) * 0.5;
      this.weaponMesh.rotation.x = this.idleRotation.x + xRot;
    }
  }

  /**
   * 히트 처리
   */
  public processHit(pickedMesh: Mesh, pickedPoint: Vector3, damageAmount: number): boolean {
    const metadata = pickedMesh.metadata;
    if (!metadata) return false;

    const entityId = metadata.pawn?.id || metadata.targetId;
    if (!entityId) return false;

    const part = metadata.bodyPart || metadata.part || 'body';

    this.ctx.worldManager.processHit(entityId, damageAmount, part, pickedPoint, false);

    GameObservables.targetHit.notifyObservers({
      targetId: entityId,
      part: part,
      damage: damageAmount,
      position: pickedPoint,
    });

    return true;
  }

  /**
   * 리소스 해제
   */
  public dispose(): void {
    if (this.weaponMesh) {
      this.weaponMesh.dispose();
      this.weaponMesh = null;
    }
  }
}
