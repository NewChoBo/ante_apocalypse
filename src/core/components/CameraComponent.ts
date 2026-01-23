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

  constructor(owner: BasePawn, scene: Scene, initialHeight: number = 0) {
    super(owner, scene);

    this.camera = new UniversalCamera('pawnCamera', Vector3.Zero(), scene);
    this.camera.parent = this.owner.mesh;
    this.camera.position.set(0, initialHeight, 0); // 기본 높이 설정
    this.camera.minZ = 0.1;
    this.camera.fov = 1.2;
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

  public update(_deltaTime: number): void {
    // 카메라 위치나 흔들림 로직이 필요할 경우 여기에 추가
  }

  public setMouseSensitivity(value: number): void {
    this.mouseSensitivity = value;
  }

  public dispose(): void {
    super.dispose();
    this.camera.dispose();
  }
}
