import { UniversalCamera, Vector3, Scene } from '@babylonjs/core';
import { BaseComponent } from '../base/BaseComponent';
import { CombatComponent } from '../combat/CombatComponent';
import type { BasePawn } from '../../BasePawn';
import { settingsStore } from '../../store/SettingsStore';

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
  private settingsUnsubscribe: (() => void) | null = null;
  private minPitch = -Math.PI / 2 + 0.1;
  private maxPitch = Math.PI / 2 - 0.1;

  // ADS & Recoil 관련 변수
  private defaultFOV = 1.2;
  private currentFOV = 1.2;

  private currentRecoilOffset = 0;
  private targetRecoilOffset = 0;

  private isDetached = false;
  private initialHeight = 0;

  constructor(owner: BasePawn, scene: Scene, initialHeight: number = 0) {
    super(owner, scene);
    this.initialHeight = initialHeight;

    this.camera = new UniversalCamera('pawnCamera', Vector3.Zero(), scene);
    this.camera.parent = this.owner.mesh;
    this.camera.position.set(0, initialHeight, 0); // 기본 높이 설정
    this.camera.minZ = 0.1;
    this.camera.fov = this.defaultFOV;
    this.camera.inputs.clear(); // 컨트롤러에서 제어하므로 입력 해제

    // 초기 감도 설정 및 구독
    const currentSettings = settingsStore.get();
    this.mouseSensitivity = currentSettings.mouseSensitivity;
    this.settingsUnsubscribe = settingsStore.subscribe((state) => {
      this.mouseSensitivity = state.mouseSensitivity;
    });
  }

  public detach(): void {
    if (this.isDetached) return;
    this.isDetached = true;

    // Get current world position and rotation before detaching
    this.camera.computeWorldMatrix();
    const worldPos = this.camera.position.add(this.owner.mesh.getAbsolutePosition());

    // For rotation, we can use the world matrix or just combine mesh + camera rotation
    const worldYaw = this.owner.mesh.rotation.y;
    const worldPitch = this.camera.rotation.x;

    this.camera.parent = null;
    this.camera.position.copyFrom(worldPos);
    this.camera.rotation.set(worldPitch, worldYaw, 0);
  }

  public attach(): void {
    if (!this.isDetached) return;
    this.isDetached = false;

    this.camera.parent = this.owner.mesh;
    this.camera.position.set(0, this.initialHeight, 0);
    this.camera.rotation.set(0, 0, 0);
  }

  /** 마우스 델타값에 기반해 회전 처리 */
  public handleRotation(delta: RotationInput): void {
    if (this.isDetached) {
      // Independent camera rotation
      this.camera.rotation.y += delta.x * this.mouseSensitivity;
    } else {
      // 1. 몸체 회전 (Yaw - Y축)
      this.owner.mesh.rotation.y += delta.x * this.mouseSensitivity;
    }

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
    // 목표 반동값을 증가시킴
    this.targetRecoilOffset += force;
  }

  public update(deltaTime: number): void {
    const combatComp = this.owner.getComponent(CombatComponent);
    if (!combatComp) return;

    // 1. FOV 처리
    const weapon = combatComp.getCurrentWeapon();
    const targetFOV = weapon ? weapon.getDesiredFOV(this.defaultFOV) : this.defaultFOV;

    this.currentFOV = this.currentFOV + (targetFOV - this.currentFOV) * (10 * deltaTime);
    this.camera.fov = this.currentFOV;

    // 2. 반동 처리 (Recoil)
    // 현재 반동 상태를 목표값으로 보간 (Kick)
    const previousOffset = this.currentRecoilOffset;
    this.currentRecoilOffset = this.lerp(
      this.currentRecoilOffset,
      this.targetRecoilOffset,
      15 * deltaTime
    );

    // 이번 프레임의 반동 델타를 카메라에 적용
    const recoilDelta = this.currentRecoilOffset - previousOffset;
    this.camera.rotation.x -= recoilDelta;

    // 목표 반동값을 0으로 복구 (Recovery)
    this.targetRecoilOffset = this.lerp(this.targetRecoilOffset, 0, 5 * deltaTime);
  }

  private lerp(start: number, end: number, amt: number): number {
    return (1 - amt) * start + amt * end;
  }

  public setMouseSensitivity(value: number): void {
    this.mouseSensitivity = value;
  }

  public dispose(): void {
    super.dispose();
    if (this.settingsUnsubscribe) {
      this.settingsUnsubscribe();
    }
    this.camera.dispose();
  }
}

