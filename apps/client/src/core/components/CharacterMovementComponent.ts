import { Vector3, Scene, AbstractMesh } from '@babylonjs/core';
import { IPawnComponent } from '@ante/common';
import { MovementComponent } from '@ante/game-core';
import { CombatComponent } from './CombatComponent';
import { CameraComponent } from './CameraComponent';
import type { BasePawn } from '../BasePawn';
import { MovementConfig } from '../../config';

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
 * CharacterMovementComponent - Character-specific movement component
 *
 * Uses MovementComponent via composition pattern for:
 * - Input-based movement
 * - Jump/crouch support
 * - Animation sync
 * - Gravity application
 */
export class CharacterMovementComponent implements IPawnComponent<BasePawn> {
  public readonly componentId: string;
  public readonly componentType = 'CharacterMovement';
  public isActive = true;

  // MovementComponent instance (composition)
  private readonly movement: MovementComponent;

  // Character-specific config (magic numbers replaced with constants)
  private readonly walkSpeed = MovementConfig.WALK_SPEED;
  private readonly runSpeed: number =
    MovementConfig.WALK_SPEED * MovementConfig.RUN_SPEED_MULTIPLIER;
  private readonly crouchMultiplier = MovementConfig.CROUCH_MULTIPLIER;
  private readonly jumpForce = MovementConfig.JUMP_FORCE;

  // Character state
  private velocityY = 0;
  private isGrounded = false;
  private isRunning = false;

  // Owner reference
  private owner: BasePawn | null = null;

  constructor(config?: { componentId?: string }) {
    this.componentId =
      config?.componentId ?? `character_movement_${Math.random().toString(36).substr(2, 9)}`;
    this.movement = new MovementComponent({} as Scene, {
      walkSpeed: this.walkSpeed as 6,
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

  /** Delegates to MovementComponent */
  public move(direction: Vector3, speed?: number): void {
    this.movement.move(direction, speed);
  }

  /** Delegates to MovementComponent */
  public stop(): void {
    this.movement.stop();
  }

  /** Delegates to MovementComponent */
  public lookAt(targetPoint: Vector3): void {
    this.movement.lookAt(targetPoint);
  }

  /** Delegates to MovementComponent */
  public teleport(position: Vector3): void {
    this.movement.teleport(position);
  }

  /** Delegates to MovementComponent */
  public getVelocity(): Vector3 {
    return this.movement.getVelocity();
  }

  /** Delegates to MovementComponent */
  public getSpeed(): number {
    return this.movement.getSpeed();
  }

  /** Delegates to MovementComponent */
  public getIsMoving(): boolean {
    return this.movement.getIsMoving();
  }

  /** MovementComponent에 위임 */
  public setRunning(running: boolean): void {
    this.isRunning = running;
    this.movement.setRunning(running);
  }

  /** Delegates to MovementComponent */
  public getState(): ReturnType<MovementComponent['getState']> {
    return this.movement.getState();
  }

  /** Handle movement based on input data */
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

    // Determine movement speed
    let speed: number = this.walkSpeed;
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

    // Calculate direction
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

    // Jump handling
    if (this.isGrounded && input.jump && !input.crouch) {
      this.velocityY = this.jumpForce;
      this.isGrounded = false;
    }
  }

  private handleGhostMovement(input: MovementInput, deltaTime: number): void {
    const ghostSpeed = this.walkSpeed * MovementConfig.GHOST_SPEED_MULTIPLIER;
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

  /** Update loop */
  public update(deltaTime: number): void {
    const pawn = this.pawn;
    if (!pawn || !pawn.isDead) {
      this.updateGravity(deltaTime);
    }
  }

  private updateGravity(deltaTime: number): void {
    const mesh = this.mesh;
    if (!mesh) return;

    // Apply gravity
    this.velocityY += MovementConfig.GRAVITY * deltaTime;

    const velocity = new Vector3(0, this.velocityY * deltaTime, 0);
    mesh.moveWithCollisions(velocity);

    // Ground detection
    if (mesh.position.y <= 0) {
      mesh.position.y = 0;
      this.velocityY = 0;
      this.isGrounded = true;
    }
  }

  /** Returns current movement state */
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
