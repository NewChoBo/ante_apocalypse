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
  crouch: boolean;
}

/**
 * 캐릭터의 이동, 중력, 점프 로직을 담당하는 컴포넌트.
 */
export class CharacterMovementComponent extends BaseComponent {
  private playerHeight = 1.8;
  private crouchHeight = 1.0;
  private moveSpeed = 8;
  private sprintMultiplier = 1.6;
  private crouchMultiplier = 0.5;

  // 중력/상태 변수
  private velocityY = 0;
  private gravity = -25;
  private jumpForce = 9;
  private isGrounded = false;
  private currentHeight = 1.8;

  constructor(owner: BasePawn, scene: Scene) {
    super(owner, scene);
    this.currentHeight = this.playerHeight;
  }

  /** 입력 데이터에 기반해 이동 처리 */
  public handleMovement(input: MovementInput, deltaTime: number): void {
    // 1. 앉기 상태 처리 (높이 변경)
    const targetHeight = input.crouch ? this.crouchHeight : this.playerHeight;
    // 부드러운 전환을 위해 보간 사용 (옵션, 여기서는 즉시 변경)
    this.currentHeight = targetHeight;

    let speed = this.moveSpeed;
    if (input.crouch && this.isGrounded) {
      speed *= this.crouchMultiplier;
    } else if (input.sprint) {
      speed *= this.sprintMultiplier;
    }

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

    // 2. 점프 시도 (앉아있을 때는 점프 불가)
    if (this.isGrounded && input.jump && !input.crouch) {
      this.velocityY = this.jumpForce;
      this.isGrounded = false;
    }
  }

  public update(deltaTime: number): void {
    this.updateGravity(deltaTime);
  }

  private updateGravity(deltaTime: number): void {
    this.checkGround();

    if (this.isGrounded && this.velocityY < 0) {
      this.velocityY = 0;
    } else if (!this.isGrounded) {
      this.velocityY += this.gravity * deltaTime;
    }

    this.owner.mesh.position.y += this.velocityY * deltaTime;

    // 최소 높이 안전장치
    if (this.owner.mesh.position.y < this.currentHeight) {
      this.owner.mesh.position.y = this.currentHeight;
      this.velocityY = 0;
      this.isGrounded = true;
    }
  }

  private checkGround(): void {
    const ray = new Ray(this.owner.mesh.position, Vector3.Down(), this.currentHeight + 0.1);
    const pickInfo = this.scene.pickWithRay(ray, (m) => m.isPickable && m !== this.owner.mesh);
    this.isGrounded = !!pickInfo?.hit;
  }

  // 외부에서 상태 설정을 위해 필요한 경우 메서드 추가 가능
  public setMovementSpeed(speed: number): void {
    this.moveSpeed = speed;
  }
}
