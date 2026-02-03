import { Vector3, Scene } from '@babylonjs/core';
import { IPawnComponent, IPawn, Logger } from '@ante/common';

const logger = new Logger('MovementComponent');

/**
 * Movement configuration options
 */
export interface MovementConfig {
  walkSpeed: number;
  runSpeed?: number;
  acceleration?: number;
  deceleration?: number;
  rotationSpeed?: number;
  canFly?: boolean;
  gravity?: number;
  componentId?: string;
}

/**
 * MovementComponent - Server-side movement logic for pawns
 *
 * This component handles:
 * - Velocity-based movement
 * - Acceleration/deceleration
 * - Rotation smoothing
 * - Ground clamping (optional)
 *
 * Usage:
 * ```typescript
 * const movement = new MovementComponent(scene, {
 *   walkSpeed: 3,
 *   runSpeed: 6,
 *   acceleration: 10,
 *   deceleration: 8
 * });
 * pawn.addComponent(movement);
 * movement.moveTo(targetPosition);
 * ```
 */
export class MovementComponent implements IPawnComponent<IPawn> {
  public readonly componentId: string;
  public readonly componentType = 'MovementComponent';
  public isActive = true;

  // Configuration
  private walkSpeed: number;
  private runSpeed: number;
  private acceleration: number;
  private deceleration: number;
  private rotationSpeed: number;
  private canFly: boolean;
  private gravity: number;

  // State
  private currentVelocity = Vector3.Zero();
  private targetVelocity = Vector3.Zero();
  private isMoving = false;
  private isRunning = false;
  private currentSpeed = 0;

  // Owner reference
  private owner: IPawn | null = null;
  private scene: Scene;

  // Target tracking (for AI)
  private targetPosition: Vector3 | null = null;
  private arrivalThreshold = 0.5;
  private onArrivalCallback: (() => void) | null = null;

  constructor(scene: Scene, config: MovementConfig) {
    this.scene = scene;
    this.componentId = config.componentId ?? `movement_${Math.random().toString(36).substr(2, 9)}`;
    this.walkSpeed = config.walkSpeed;
    this.runSpeed = config.runSpeed ?? config.walkSpeed * 2;
    this.acceleration = config.acceleration ?? 10;
    this.deceleration = config.deceleration ?? 8;
    this.rotationSpeed = config.rotationSpeed ?? 5;
    this.canFly = config.canFly ?? false;
    this.gravity = config.gravity ?? 9.81;
  }

  // ============================================
  // IPawnComponent Implementation
  // ============================================

  public onAttach(pawn: IPawn): void {
    this.owner = pawn;
    logger.debug(`MovementComponent attached to pawn ${pawn.id}`);
  }

  public update(deltaTime: number): void {
    if (!this.isActive || !this.owner) return;

    // Handle AI target movement
    if (this.targetPosition) {
      this.updateTargetMovement(deltaTime);
    }

    // Apply acceleration/deceleration
    this.updateVelocity(deltaTime);

    // Apply movement
    this.applyMovement(deltaTime);

    // Apply gravity if not flying
    if (!this.canFly) {
      this.applyGravity(deltaTime);
    }
  }

  public onDetach(): void {
    this.owner = null;
    this.targetPosition = null;
    this.onArrivalCallback = null;
  }

  public dispose(): void {
    this.onDetach();
  }

  // ============================================
  // Movement Control
  // ============================================

  /**
   * Move in a direction (for direct control)
   */
  public move(direction: Vector3, speed?: number): void {
    if (!this.owner) return;

    const targetSpeed = speed ?? (this.isRunning ? this.runSpeed : this.walkSpeed);
    this.targetVelocity = direction.normalize().scale(targetSpeed);
    this.isMoving = direction.length() > 0.001;
    this.currentSpeed = targetSpeed;

    // Rotate towards movement direction
    if (this.isMoving && direction.length() > 0.001) {
      this.rotateTowards(direction, this.scene.getEngine().getDeltaTime() / 1000);
    }
  }

  /**
   * Move to a specific position (for AI)
   */
  public moveTo(position: Vector3, onArrival?: () => void): void {
    this.targetPosition = position.clone();
    this.onArrivalCallback = onArrival ?? null;
    this.isMoving = true;
  }

  /**
   * Stop movement
   */
  public stop(): void {
    this.targetVelocity = Vector3.Zero();
    this.isMoving = false;
    this.targetPosition = null;
    this.onArrivalCallback = null;
  }

  /**
   * Set running state
   */
  public setRunning(running: boolean): void {
    this.isRunning = running;
    if (this.isMoving) {
      // Update current speed based on run state
      this.currentSpeed = running ? this.runSpeed : this.walkSpeed;
      // Reapply movement with new speed if we have a direction
      const currentDir = this.targetVelocity.normalize();
      if (currentDir.length() > 0.001) {
        this.targetVelocity = currentDir.scale(this.currentSpeed);
      }
    }
  }

  /**
   * Teleport to position (instant, no velocity)
   */
  public teleport(position: Vector3): void {
    if (!this.owner) return;
    // Convert Babylon Vector3 to the position format expected by IPawn
    this.owner.position = { x: position.x, y: position.y, z: position.z };
    this.currentVelocity = Vector3.Zero();
    this.targetVelocity = Vector3.Zero();
  }

  // ============================================
  // Rotation
  // ============================================

  /**
   * Smoothly rotate towards a direction
   */
  public rotateTowards(direction: Vector3, deltaTime: number): void {
    if (!this.owner || direction.length() < 0.001) return;

    const targetRotation = Math.atan2(direction.x, direction.z);
    let currentRotation = this.owner.rotation.y;

    // Normalize angles
    while (targetRotation - currentRotation > Math.PI) currentRotation += Math.PI * 2;
    while (targetRotation - currentRotation < -Math.PI) currentRotation -= Math.PI * 2;

    // Smooth interpolation
    const newRotation =
      currentRotation + (targetRotation - currentRotation) * this.rotationSpeed * deltaTime;
    this.owner.rotation.y = newRotation;
  }

  /**
   * Look at a specific point
   */
  public lookAt(targetPoint: Vector3): void {
    if (!this.owner) return;

    // Convert owner position to Babylon Vector3 for calculation
    const ownerPos = new Vector3(
      this.owner.position.x,
      this.owner.position.y,
      this.owner.position.z
    );
    const direction = targetPoint.subtract(ownerPos);
    direction.y = 0; // Keep level

    if (direction.length() > 0.001) {
      const targetRotation = Math.atan2(direction.x, direction.z);
      this.owner.rotation.y = targetRotation;
    }
  }

  // ============================================
  // Queries
  // ============================================

  public getVelocity(): Vector3 {
    return this.currentVelocity.clone();
  }

  public getSpeed(): number {
    return this.currentVelocity.length();
  }

  public getIsMoving(): boolean {
    return this.isMoving;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public getRemainingDistance(): number {
    if (!this.targetPosition || !this.owner) return 0;
    const ownerPos = new Vector3(
      this.owner.position.x,
      this.owner.position.y,
      this.owner.position.z
    );
    return Vector3.Distance(ownerPos, this.targetPosition);
  }

  // ============================================
  // Private Methods
  // ============================================

  private updateVelocity(deltaTime: number): void {
    if (this.isMoving) {
      // Accelerate towards target velocity
      const diff = this.targetVelocity.subtract(this.currentVelocity);
      const maxDelta = this.acceleration * deltaTime;

      if (diff.length() <= maxDelta) {
        this.currentVelocity = this.targetVelocity.clone();
      } else {
        const accelDir = diff.normalize();
        this.currentVelocity.addInPlace(accelDir.scale(maxDelta));
      }
    } else {
      // Decelerate to stop
      if (this.currentVelocity.length() > 0.001) {
        const decelAmount = this.deceleration * deltaTime;
        if (this.currentVelocity.length() <= decelAmount) {
          this.currentVelocity = Vector3.Zero();
        } else {
          const decelDir = this.currentVelocity.normalize().scale(-1);
          this.currentVelocity.addInPlace(decelDir.scale(decelAmount));
        }
      } else {
        this.currentVelocity = Vector3.Zero();
      }
    }
  }

  private applyMovement(deltaTime: number): void {
    if (!this.owner || this.currentVelocity.length() < 0.001) return;

    const displacement = this.currentVelocity.scale(deltaTime);
    // Update position using the owner's position property
    const currentPos = this.owner.position;
    this.owner.position = {
      x: currentPos.x + displacement.x,
      y: currentPos.y + displacement.y,
      z: currentPos.z + displacement.z,
    };
  }

  private applyGravity(_deltaTime: number): void {
    if (!this.owner) return;

    // Simple ground clamping - in a real implementation,
    // you'd use collision detection with the ground
    if (this.owner.position.y > 0) {
      this.currentVelocity.y -= this.gravity * _deltaTime;
    } else {
      this.owner.position.y = 0;
      this.currentVelocity.y = 0;
    }
  }

  private updateTargetMovement(_deltaTime: number): void {
    if (!this.owner || !this.targetPosition) return;

    const ownerPos = new Vector3(
      this.owner.position.x,
      this.owner.position.y,
      this.owner.position.z
    );
    const distance = Vector3.Distance(ownerPos, this.targetPosition);

    // Check if arrived
    if (distance <= this.arrivalThreshold) {
      this.stop();
      if (this.onArrivalCallback) {
        this.onArrivalCallback();
        this.onArrivalCallback = null;
      }
      return;
    }

    // Calculate direction and move
    const direction = this.targetPosition.subtract(ownerPos).normalize();
    direction.y = 0; // Keep movement horizontal

    this.move(direction, this.currentSpeed);
  }
}
