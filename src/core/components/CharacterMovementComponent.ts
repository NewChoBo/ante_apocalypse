import { Vector3, Scene, Ray } from '@babylonjs/core';
import { BaseComponent } from './BaseComponent';
import type { BasePawn } from '../BasePawn';

export interface MovementInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
}

/**
 * 캐릭터의 이동, 중력, 점프 로직을 담당하는 컴포넌트.
 */
export class CharacterMovementComponent extends BaseComponent {
  private playerHeight = 1.8;
  private moveSpeed = 8;
  private sprintMultiplier = 1.6;

  // 중력/상태 변수
  private velocityY = 0;
  private gravity = -25;
  private jumpForce = 9;
  private isGrounded = false;

  constructor(owner: BasePawn, scene: Scene) {
    super(owner, scene);
  }

  /** 입력 데이터에 기반해 이동 처리 */
  public handleMovement(input: MovementInput, deltaTime: number): void {
    const speed = this.moveSpeed * (input.sprint ? this.sprintMultiplier : 1);
    const forward = this.owner.mesh.getDirection(Vector3.Forward());
    const right = this.owner.mesh.getDirection(Vector3.Right());

    const moveDirection = Vector3.Zero();
    if (input.forward) moveDirection.addInPlace(forward);
    if (input.backward) moveDirection.subtractInPlace(forward);
    if (input.right) moveDirection.addInPlace(right);
    if (input.left) moveDirection.subtractInPlace(right);

    if (moveDirection.length() > 0) {
      moveDirection.normalize();
      this.owner.mesh.position.addInPlace(moveDirection.scale(speed * deltaTime));
    }

    // 점프 시도
    if (this.isGrounded && input.jump) {
      this.velocityY = this.jumpForce;
      this.isGrounded = false;
    }
  }

  public update(deltaTime: number): void {
    this.updateGravity(deltaTime);
  }

  private updateGravity(deltaTime: number): void {
    this.checkGround();

    if (this.isGrounded) {
      this.velocityY = 0;
    } else {
      this.velocityY += this.gravity * deltaTime;
    }

    this.owner.mesh.position.y += this.velocityY * deltaTime;

    // 최소 높이 안전장치
    if (this.owner.mesh.position.y < this.playerHeight) {
      this.owner.mesh.position.y = this.playerHeight;
      this.velocityY = 0;
      this.isGrounded = true;
    }
  }

  private checkGround(): void {
    const ray = new Ray(this.owner.mesh.position, Vector3.Down(), this.playerHeight + 0.1);
    const pickInfo = this.scene.pickWithRay(ray, (m) => m.isPickable && m !== this.owner.mesh);
    this.isGrounded = !!pickInfo?.hit;
  }

  // 외부에서 상태 설정을 위해 필요한 경우 메서드 추가 가능
  public setMovementSpeed(speed: number): void {
    this.moveSpeed = speed;
  }
}
