import { UniversalCamera, Vector3, Scene } from '@babylonjs/core';
import { BaseComponent } from './BaseComponent';
import type { BasePawn } from '../BasePawn';

export interface RotationInput {
  x: number;
  y: number;
}

/**
 * 캐릭터의 카메라와 마우스 회전(Pitch/Yaw)을 담당하는 컴포넌트.
 */
export class CameraComponent extends BaseComponent {
  public camera: UniversalCamera;
  private mouseSensitivity = 0.002;
  private minPitch = -Math.PI / 2 + 0.1;
  private maxPitch = Math.PI / 2 - 0.1;

  // ADS & Recoil 관련 변수
  private defaultFOV = 1.2;
  private adsFOV = 0.8;
  private currentFOV = 1.2;
  private isAiming = false;

  constructor(owner: BasePawn, scene: Scene, initialHeight: number = 0) {
    super(owner, scene);

    this.camera = new UniversalCamera('pawnCamera', Vector3.Zero(), scene);
    this.camera.parent = this.owner.mesh;
    this.camera.position.set(0, initialHeight, 0); // 기본 높이 설정
    this.camera.minZ = 0.1;
    this.camera.fov = this.defaultFOV;
    this.camera.inputs.clear(); // 컨트롤러에서 제어하므로 입력 해제
  }

  /** 마우스 델타값에 기반해 회전 처리 */
  public handleRotation(delta: RotationInput): void {
    // 1. 몸체 회전 (Yaw - Y축)
    this.owner.mesh.rotation.y += delta.x * this.mouseSensitivity;

    // 2. 카메라 회전 (Pitch - X축)
    this.camera.rotation.x += delta.y * this.mouseSensitivity;

    // Pitch 제한 (고개 꺾임 방지)
    this.camera.rotation.x = Math.max(
      this.minPitch,
      Math.min(this.maxPitch, this.camera.rotation.x)
    );
  }

  /** 반동 적용 */
  public applyRecoil(force: number): void {
    // 카메라를 위로 튕김 (X축 회전 감소)
    this.camera.rotation.x -= force;
  }

  /** 정조준 상태 설정 */
  public setAiming(active: boolean): void {
    this.isAiming = active;
  }

  public update(deltaTime: number): void {
    // FOV 보간 (정조준 줌 효과)
    const targetFOV = this.isAiming ? this.adsFOV : this.defaultFOV;
    this.currentFOV = this.currentFOV + (targetFOV - this.currentFOV) * (10 * deltaTime);
    this.camera.fov = this.currentFOV;
  }

  public setMouseSensitivity(value: number): void {
    this.mouseSensitivity = value;
  }

  public dispose(): void {
    super.dispose();
    this.camera.dispose();
  }
}
