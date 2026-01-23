import { Mesh, Vector3, Scene, UniversalCamera } from '@babylonjs/core';
import { BasePawn } from './BasePawn.ts';
import { CharacterMovementComponent } from './components/CharacterMovementComponent';

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
  crouch: boolean;
}

export interface MouseDelta {
  x: number;
  y: number;
}

/**
 * 1인칭 플레이어 캐릭터 실체 (Pawn).
 */
export class PlayerPawn extends BasePawn {
  public mesh: Mesh;
  public camera: UniversalCamera;

  private mouseSensitivity = 0.002;
  private movementComponent: CharacterMovementComponent;

  constructor(scene: Scene) {
    super(scene);

    // 단순한 히트박스 또는 투명 메쉬 (Pawn의 실체)
    this.mesh = Mesh.CreateBox('playerPawn', 0.5, scene);
    this.mesh.isVisible = false; // 1인칭에서는 자신의 몸이 안보이게 함
    this.mesh.position.set(0, 1.8, -5);

    // 카메라 부착
    this.camera = new UniversalCamera('fpsCamera', Vector3.Zero(), scene);
    this.camera.parent = this.mesh;
    this.camera.minZ = 0.1;
    this.camera.fov = 1.2;
    this.camera.inputs.clear(); // Controller가 제어하므로 입력 해제

    // 컴포넌트 추가
    this.movementComponent = new CharacterMovementComponent(this, scene);
    this.addComponent(this.movementComponent);
  }

  public initialize(): void {
    // 추가 초기화 로직
  }

  /** Controller로부터 입력을 받아 이동 처리 */
  public handleInput(keys: InputState, mouseDelta: MouseDelta, deltaTime: number): void {
    // 1. 회전 처리 (카메라는 X축, 몸체는 Y축)
    this.mesh.rotation.y += mouseDelta.x * this.mouseSensitivity;
    this.camera.rotation.x += mouseDelta.y * this.mouseSensitivity;
    this.camera.rotation.x = Math.max(
      -Math.PI / 2 + 0.1,
      Math.min(Math.PI / 2 - 0.1, this.camera.rotation.x)
    );

    // 2. 이동 처리를 컴포넌트에 위임
    this.movementComponent.handleMovement(keys, deltaTime);
  }

  public update(deltaTime: number): void {
    // 모든 컴포넌트 업데이트 호출 (중력 등)
    this.updateComponents(deltaTime);
  }
}
