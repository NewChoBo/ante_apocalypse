import { Vector3, Scene, Ray } from '@babylonjs/core';
import { BaseComponent } from '@/core/components/base/BaseComponent';
import { CombatComponent } from '../combat/CombatComponent';
import { InputComponent, InputState } from '../input/InputComponent';
import type { IPawn } from '../../../types/IPawn';
import { InputAction } from '@/types/InputTypes';

/**
 * 캐릭터의 이동, 중력, 점프 로직을 담당하는 컴포넌트.
 */
export class CharacterMovementComponent extends BaseComponent {
  public name = 'CharacterMovement';
  private playerHeight = 1.75;
  private crouchHeight = 1.0;
  private moveSpeed = 8;
  private sprintMultiplier = 1.6;
  private crouchMultiplier = 0.5;

  // 중력/상태 변수
  private velocityY = 0;
  private gravity = -25;
  private jumpForce = 9;
  private isGrounded = false;
  private currentHeight = 1.75;

  constructor(owner: IPawn, scene: Scene) {
    super(owner, scene);
    this.currentHeight = this.playerHeight;
  }

  public update(deltaTime: number): void {
    // 1. 중력 처리 (항상 실행)
    this.updateGravity(deltaTime);

    // 2. 입력 처리 (InputComponent가 있는 경우)
    const inputComp = this.owner.getComponent(InputComponent);
    if (inputComp instanceof InputComponent) {
      this.processMovement(inputComp.state, deltaTime);
    }
  }

  private processMovement(input: InputState, deltaTime: number): void {
    // 1. 앉기 상태 처리 (높이 변경)
    const targetHeight = input[InputAction.CROUCH] ? this.crouchHeight : this.playerHeight;
    this.currentHeight = targetHeight;

    const combatComp = this.owner.getComponent(CombatComponent);
    const weapon = combatComp ? combatComp.getCurrentWeapon() : null;
    const weaponSpeedMult = weapon ? weapon.getMovementSpeedMultiplier() : 1.0;

    let speed = this.moveSpeed;
    if (input[InputAction.CROUCH] && this.isGrounded) {
      speed *= this.crouchMultiplier;
    } else if (input[InputAction.AIM] && this.isGrounded) {
      speed *= weaponSpeedMult;
    } else if (input[InputAction.SPRINT]) {
      speed *= this.sprintMultiplier;
    }

    const forward = this.owner.mesh.getDirection(Vector3.Forward());
    const right = this.owner.mesh.getDirection(Vector3.Right());

    const moveDirection = Vector3.Zero();
    if (input[InputAction.MOVE_FORWARD]) moveDirection.addInPlace(forward);
    if (input[InputAction.MOVE_BACKWARD]) moveDirection.subtractInPlace(forward);
    if (input[InputAction.MOVE_RIGHT]) moveDirection.addInPlace(right);
    if (input[InputAction.MOVE_LEFT]) moveDirection.subtractInPlace(right);

    if (moveDirection.length() > 0) {
      moveDirection.normalize();
      const velocity = moveDirection.scale(speed * deltaTime);
      this.owner.mesh.moveWithCollisions(velocity);
    }

    // 2. 점프 시도 (앉아있을 때는 점프 불가)
    if (this.isGrounded && input[InputAction.JUMP] && !input[InputAction.CROUCH]) {
      this.velocityY = this.jumpForce;
      this.isGrounded = false;
    }
  }

  private updateGravity(deltaTime: number): void {
    this.checkGround();

    if (this.isGrounded && this.velocityY < 0) {
      this.velocityY = 0;
    } else if (!this.isGrounded) {
      this.velocityY += this.gravity * deltaTime;
    }

    const gravityVelocity = new Vector3(0, this.velocityY * deltaTime, 0);
    this.owner.mesh.moveWithCollisions(gravityVelocity);

    // 최소 높이 안전장치 (또는 바닥 충돌 시 처리)
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

  public setMovementSpeed(speed: number): void {
    this.moveSpeed = speed;
  }
}
