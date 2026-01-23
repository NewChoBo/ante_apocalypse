import { Scene, Mesh, UniversalCamera } from '@babylonjs/core';
import { IWeapon } from '../types/IWeapon.ts';
import { TargetManager } from '../targets/TargetManager.ts';

/**
 * 모든 무기의 최상위 추상 클래스.
 * 총기, 근접 무기 등에 공통적으로 필요한 기본 필드와 메서드만 포함합니다.
 */
export abstract class BaseWeapon implements IWeapon {
  public abstract name: string;
  public abstract damage: number;
  public abstract range: number;

  protected scene: Scene;
  protected camera: UniversalCamera;
  protected targetManager: TargetManager;
  protected onScoreCallback: ((points: number) => void) | null = null;
  protected weaponMesh: Mesh | null = null;

  public isActive = false;
  public isAiming = false;

  public getMovementSpeedMultiplier(): number {
    return 1.0;
  }

  public getDesiredFOV(defaultFOV: number): number {
    return defaultFOV;
  }

  constructor(
    scene: Scene,
    camera: UniversalCamera,
    targetManager: TargetManager,
    onScore?: (points: number) => void
  ) {
    this.scene = scene;
    this.camera = camera;
    this.targetManager = targetManager;
    this.onScoreCallback = onScore || null;
  }

  /** 무기 사용 (사격 혹은 휘두르기) */
  public abstract fire(): boolean;

  /** 사용 시작 (연사 혹은 차지) */
  public abstract startFire(): void;

  /** 사용 중지 */
  public abstract stopFire(): void;

  /** 매 프레임 업데이트 */
  public abstract update(deltaTime: number): void;

  /** 무기 스탯 정보 */
  public abstract getStats(): Record<string, unknown>;

  public show(): void {
    this.isActive = true;
    if (this.weaponMesh) {
      this.weaponMesh.setEnabled(true);
    }
  }

  public hide(): void {
    this.isActive = false;
    this.stopFire();
    if (this.weaponMesh) {
      this.weaponMesh.setEnabled(false);
    }
  }

  public setAiming(isAiming: boolean): void {
    this.isAiming = isAiming;
  }

  public dispose(): void {
    if (this.weaponMesh) {
      this.weaponMesh.dispose();
    }
  }
}
