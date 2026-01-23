import { Mesh, Scene, UniversalCamera } from '@babylonjs/core';
import { BasePawn } from './BasePawn.ts';
import { CharacterMovementComponent } from './components/CharacterMovementComponent';
import { CameraComponent } from './components/CameraComponent';

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
  private movementComponent: CharacterMovementComponent;
  private cameraComponent: CameraComponent;

  constructor(scene: Scene) {
    super(scene);

    // 단순한 히트박스 또는 투명 메쉬 (Pawn의 실체)
    this.mesh = Mesh.CreateBox('playerPawn', 0.5, scene);
    this.mesh.isVisible = false; // 1인칭에서는 자신의 몸이 안보이게 함
    this.mesh.position.set(0, 1.75, -5);

    // 카메라 컴포넌트 추가 (오프셋 0: 메쉬 위치가 눈 높이임)
    this.cameraComponent = new CameraComponent(this, scene, 0);
    this.addComponent(this.cameraComponent);

    // 이동 컴포넌트 추가
    this.movementComponent = new CharacterMovementComponent(this, scene);
    this.addComponent(this.movementComponent);
  }

  public get camera(): UniversalCamera {
    return this.cameraComponent.camera;
  }

  public initialize(): void {
    // 추가 초기화 로직
  }

  /** Controller로부터 입력을 받아 처리 */
  public handleInput(keys: InputState, mouseDelta: MouseDelta, deltaTime: number): void {
    // 1. 회전 처리를 컴포넌트에 위임
    this.cameraComponent.handleRotation(mouseDelta);

    // 2. 이동 처리를 컴포넌트에 위임
    this.movementComponent.handleMovement(keys, deltaTime);
  }

  public update(deltaTime: number): void {
    // 모든 컴포넌트 업데이트 호출
    this.updateComponents(deltaTime);
  }
}
