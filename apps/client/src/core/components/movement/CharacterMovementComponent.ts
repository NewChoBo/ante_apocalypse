import { Vector3, Scene, Ray } from '@babylonjs/core';
import { BaseComponent } from '../base/BaseComponent';
import { CombatComponent } from '../combat/CombatComponent';
import { CameraComponent } from './CameraComponent';
import type { BasePawn } from '../../BasePawn';

export interface MovementInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
  crouch: boolean;
  aim: boolean;
}

/**
 * 캐릭터의 이동, 중력, 점프 로직을 담당하는 컴포넌트.
 */
export class CharacterMovementComponent extends BaseComponent {
  private moveSpeed = 6;
  private sprintMultiplier = 1.6;
  private crouchMultiplier = 0.5;

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
    const isGhost = this.owner.isDead;

    if (isGhost) {
      this.handleGhostMovement(input, deltaTime);
      return;
    }

    const combatComp = this.owner.getComponent(CombatComponent);
    const weapon = combatComp ? combatComp.getCurrentWeapon() : null;
    const weaponSpeedMult = weapon ? weapon.getMovementSpeedMultiplier() : 1.0;

    let speed = this.moveSpeed;
    if (input.crouch && this.isGrounded) {
      speed *= this.crouchMultiplier;
    } else if (input.aim && this.isGrounded) {
      speed *= weaponSpeedMult;
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
      const velocity = moveDirection.scale(speed * deltaTime);
      this.owner.mesh.moveWithCollisions(velocity);
    }

    // 2. 점프 시도 (앉아있을 때는 점프 불가)
    if (this.isGrounded && input.jump && !input.crouch) {
      this.velocityY = this.jumpForce;
      this.isGrounded = false;
    }
  }

  private handleGhostMovement(input: MovementInput, deltaTime: number): void {
    const ghostSpeed = this.moveSpeed * 2.0;
    const cameraComp = this.owner.getComponent(CameraComponent);
    const camera = cameraComp?.camera;
    if (!camera) return;

    // Calculate move direction based on camera orientation if detached
    // Otherwise use mesh orientation (though usually they aligned)
    const forward = camera.getForwardRay().direction;
    const right = Vector3.Cross(Vector3.Up(), forward).normalize();
    const up = Vector3.Up();

    const moveDirection = Vector3.Zero();
    if (input.forward) moveDirection.addInPlace(forward);
    if (input.backward) moveDirection.subtractInPlace(forward);
    if (input.right) moveDirection.subtractInPlace(right);
    if (input.left) moveDirection.addInPlace(right);

    // Vertical movement in ghost mode
    if (input.jump) moveDirection.addInPlace(up); // Space
    if (input.crouch) moveDirection.subtractInPlace(up); // Crouch/Ctrl

    if (moveDirection.length() > 0) {
      moveDirection.normalize();
      const velocity = moveDirection.scale(ghostSpeed * deltaTime);

      // Move camera directly (Decoupled Spectator)
      camera.position.addInPlace(velocity);
    }
  }

  public update(deltaTime: number): void {
    if (!this.owner.isDead) {
      this.updateGravity(deltaTime);
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

    // 최소 높이 안전장치 (지면 0)
    if (this.owner.mesh.position.y < 0) {
      this.owner.mesh.position.y = 0;
      this.velocityY = 0;
      this.isGrounded = true;
    }
  }

  private checkGround(): void {
    // Pivot is at feet (0), ray starts slightly above
    const ray = new Ray(this.owner.mesh.position.add(new Vector3(0, 0.1, 0)), Vector3.Down(), 0.2);
    const pickInfo = this.scene.pickWithRay(ray, (m) => m.isPickable && m !== this.owner.mesh);
    this.isGrounded = !!pickInfo?.hit;
  }

  // 외부에서 상태 설정을 위해 필요한 경우 메서드 추가 가능
  public setMovementSpeed(speed: number): void {
    this.moveSpeed = speed;
  }
}

