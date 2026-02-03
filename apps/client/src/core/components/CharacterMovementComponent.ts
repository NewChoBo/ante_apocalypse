import { Vector3, Scene, AbstractMesh } from '@babylonjs/core';
import { IPawnComponent } from '@ante/common';
import { MovementComponent } from '@ante/game-core';
import { CombatComponent } from './CombatComponent';
import { CameraComponent } from './CameraComponent';
import type { BasePawn } from '../BasePawn';

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
 * CharacterMovementComponent - 캐릭터 특유의 이동 컴포넌트
 *
 * MovementComponent를 composition으로 사용하여:
 * - 입력 기반 이동 처리
 * - 점프/크라우칭 지원
 * - 애니메이션 동기화
 * - 중력 적용
 */
export class CharacterMovementComponent implements IPawnComponent<BasePawn> {
  public readonly componentId: string;
  public readonly componentType = 'CharacterMovement';
  public isActive = true;

  // MovementComponent 인스턴스 (composition)
  private readonly movement: MovementComponent;

  // 캐릭터 특수 설정
  private readonly walkSpeed = 6;
  private readonly runSpeed = 6 * 1.6;
  private readonly crouchMultiplier = 0.5;
  private readonly jumpForce = 9;

  // 캐릭터 상태
  private velocityY = 0;
  private isGrounded = false;
  private isRunning = false;

  // Owner reference
  private owner: BasePawn | null = null;

  constructor(config?: { componentId?: string }) {
    this.componentId =
      config?.componentId ?? `character_movement_${Math.random().toString(36).substr(2, 9)}`;
    this.movement = new MovementComponent({} as Scene, {
      walkSpeed: this.walkSpeed,
      runSpeed: this.runSpeed,
      componentId: `movement_${this.componentId}`,
    });
  }

  public onAttach(pawn: BasePawn): void {
    this.owner = pawn;
    this.movement.onAttach(pawn as any);
  }

  public onDetach(): void {
    this.owner = null;
    this.movement.onDetach();
  }

  public dispose(): void {
    this.onDetach();
    this.movement.dispose();
  }

  private get pawn(): BasePawn | null {
    return this.owner;
  }

  private get mesh(): AbstractMesh | null {
    return this.pawn?.mesh as AbstractMesh | null;
  }

  /** MovementComponent에 위임 */
  public move(direction: Vector3, speed?: number): void {
    this.movement.move(direction, speed);
  }

  /** MovementComponent에 위임 */
  public stop(): void {
    this.movement.stop();
  }

  /** MovementComponent에 위임 */
  public lookAt(targetPoint: Vector3): void {
    this.movement.lookAt(targetPoint);
  }

  /** MovementComponent에 위임 */
  public teleport(position: Vector3): void {
    this.movement.teleport(position);
  }

  /** MovementComponent에 위임 */
  public getVelocity(): Vector3 {
    return this.movement.getVelocity();
  }

  /** MovementComponent에 위임 */
  public getSpeed(): number {
    return this.movement.getSpeed();
  }

  /** MovementComponent에 위임 */
  public getIsMoving(): boolean {
    return this.movement.getIsMoving();
  }

  /** MovementComponent에 위임 */
  public setRunning(running: boolean): void {
    this.isRunning = running;
    this.movement.setRunning(running);
  }

  /** MovementComponent에 위임 */
  public getState() {
    return this.movement.getState();
  }

  /** 입력 데이터에 기반해 이동 처리 */
  public handleMovement(input: MovementInput, deltaTime: number): void {
    const pawn = this.pawn;
    if (!pawn) return;

    const isGhost = pawn.isDead;

    if (isGhost) {
      this.handleGhostMovement(input, deltaTime);
      return;
    }

    const combatComp = pawn.getComponent<CombatComponent>('CombatComponent');
    const weapon = combatComp?.getCurrentWeapon();
    const weaponSpeedMult = weapon?.getMovementSpeedMultiplier() ?? 1.0;

    // 이동 속도 결정
    let speed = this.walkSpeed;
    if (input.crouch && this.isGrounded) {
      speed = this.walkSpeed * this.crouchMultiplier;
    } else if (input.aim && this.isGrounded) {
      speed = this.walkSpeed * weaponSpeedMult;
    } else if (input.sprint) {
      speed = this.runSpeed;
      this.isRunning = true;
    } else {
      this.isRunning = false;
    }

    // 방향 계산
    const mesh = this.mesh;
    if (!mesh) return;

    const forward = mesh.getDirection(Vector3.Forward());
    const right = mesh.getDirection(Vector3.Right());

    const moveDirection = Vector3.Zero();
    if (input.forward) moveDirection.addInPlace(forward);
    if (input.backward) moveDirection.subtractInPlace(forward);
    if (input.right) moveDirection.addInPlace(right);
    if (input.left) moveDirection.subtractInPlace(right);

    if (moveDirection.length() > 0) {
      moveDirection.normalize();
      this.movement.move(moveDirection, speed);
    }

    // 점프 처리
    if (this.isGrounded && input.jump && !input.crouch) {
      this.velocityY = this.jumpForce;
      this.isGrounded = false;
    }
  }

  private handleGhostMovement(input: MovementInput, deltaTime: number): void {
    const ghostSpeed = this.walkSpeed * 2.0;
    const pawn = this.pawn;
    if (!pawn) return;

    const cameraComp = pawn.getComponent<CameraComponent>('CameraComponent');
    const camera = cameraComp?.camera;
    if (!camera) return;

    const forward = camera.getForwardRay().direction;
    const right = Vector3.Cross(Vector3.Up(), forward).normalize();
    const up = Vector3.Up();

    const moveDirection = Vector3.Zero();
    if (input.forward) moveDirection.addInPlace(forward);
    if (input.backward) moveDirection.subtractInPlace(forward);
    if (input.right) moveDirection.subtractInPlace(right);
    if (input.left) moveDirection.addInPlace(right);

    if (input.jump) moveDirection.addInPlace(up);
    if (input.crouch) moveDirection.subtractInPlace(up);

    if (moveDirection.length() > 0) {
      moveDirection.normalize();
      camera.position.addInPlace(moveDirection.scale(ghostSpeed * deltaTime));
    }
  }

  /** 업데이트 루프 */
  public update(deltaTime: number): void {
    const pawn = this.pawn;
    if (!pawn || !pawn.isDead) {
      this.updateGravity(deltaTime);
    }
  }

  private updateGravity(deltaTime: number): void {
    const mesh = this.mesh;
    if (!mesh) return;

    // 간단한 중력 적용
    this.velocityY += -25 * deltaTime;

    const velocity = new Vector3(0, this.velocityY * deltaTime, 0);
    mesh.moveWithCollisions(velocity);

    // 지면 감지 (단순화)
    if (mesh.position.y <= 0) {
      mesh.position.y = 0;
      this.velocityY = 0;
      this.isGrounded = true;
    }
  }

  /** 현재 속도 상태 반환 */
  public getCharacterState(): {
    velocityY: number;
    isGrounded: boolean;
    isRunning: boolean;
  } {
    return {
      velocityY: this.velocityY,
      isGrounded: this.isGrounded,
      isRunning: this.isRunning,
    };
  }
}
