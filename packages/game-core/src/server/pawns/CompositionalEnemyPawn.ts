import { Mesh, MeshBuilder, Scene, Vector3 } from '@babylonjs/core';
import { Logger } from '@ante/common';
import { Pawn } from '../../simulation/Pawn.js';
import { HealthComponent } from '../../simulation/components/HealthComponent.js';
import { MovementComponent } from '../../simulation/components/MovementComponent.js';
import {
  AIComponent,
  AIBehaviorCallbacks,
  AITarget,
} from '../../simulation/components/AIComponent.js';
import { IEnemyPawn } from '../../types/IEnemyPawn.js';

const logger = new Logger('CompositionalEnemyPawn');

/**
 * Configuration for CompositionalEnemyPawn
 */
export interface CompositionalEnemyPawnConfig {
  // Health
  maxHealth: number;
  initialHealth?: number;

  // Movement
  walkSpeed: number;
  runSpeed?: number;
  acceleration?: number;
  deceleration?: number;

  // AI
  detectionRange: number;
  attackRange: number;
  patrolRadius?: number;
  patrolWaitTime?: number;
  attackCooldown?: number;
}

/**
 * CompositionalEnemyPawn - Proof of concept for composition-based enemy
 *
 * This pawn demonstrates the new composition architecture:
 * - Uses Pawn (composition-based) instead of BasePawn (inheritance-based)
 * - Functionality provided by components:
 *   - HealthComponent: Health management
 *   - MovementComponent: Movement and rotation
 *   - AIComponent: AI behavior state machine
 *
 * Benefits:
 * - Modular: Each feature is self-contained
 * - Reusable: Components can be shared across different pawn types
 * - Testable: Individual components can be unit tested
 * - Flexible: Easy to add/remove features without inheritance chains
 *
 * Usage:
 * ```typescript
 * const enemy = new CompositionalEnemyPawn(scene, 'enemy_1', new Vector3(0, 0, 0), {
 *   maxHealth: 100,
 *   walkSpeed: 3,
 *   detectionRange: 10,
 *   attackRange: 2
 * });
 * enemy.activate();
 * ```
 */
export class CompositionalEnemyPawn extends Pawn implements IEnemyPawn {
  public override mesh: Mesh;
  public headBox: Mesh;

  // Component references for easy access
  private healthComponent: HealthComponent;
  private movementComponent: MovementComponent;
  private aiComponent: AIComponent;

  // Configuration
  private config: CompositionalEnemyPawnConfig;

  constructor(scene: Scene, id: string, position: Vector3, config: CompositionalEnemyPawnConfig) {
    // Initialize base Pawn with composition support
    super(scene, {
      id,
      type: 'enemy',
      position,
      maxHealth: config.maxHealth,
      initialHealth: config.initialHealth ?? config.maxHealth,
    });

    // Store config for runtime access
    this.config = config;

    // Create physics mesh (root collider)
    this.mesh = this.createPhysicsMesh(id, scene, position);

    // Create head hitbox
    this.headBox = this.createHeadHitbox(id, scene);

    // Initialize components
    this.healthComponent = this.createHealthComponent(config);
    this.movementComponent = this.createMovementComponent(scene, config);
    this.aiComponent = this.createAIComponent(scene, config);

    // Add components to pawn
    this.addComponent(this.healthComponent);
    this.addComponent(this.movementComponent);
    this.addComponent(this.aiComponent);

    // Setup health event handlers
    this.setupHealthEvents();

    logger.info(`Created CompositionalEnemyPawn ${id} at ${position}`);
  }

  // ============================================
  // Mesh Creation
  // ============================================

  private createPhysicsMesh(id: string, scene: Scene, position: Vector3): Mesh {
    // Root Collider (Pivot at feet: 0.0m)
    const mesh = MeshBuilder.CreateBox(
      'enemyRoot_' + id,
      { width: 0.5, height: 2, depth: 0.5 },
      scene
    );
    mesh.setPivotPoint(new Vector3(0, -1, 0));
    mesh.position.copyFrom(position);
    mesh.checkCollisions = true;
    mesh.isPickable = true;
    mesh.metadata = { type: 'enemy', id: this.id, bodyPart: 'body', pawn: this };

    return mesh;
  }

  private createHeadHitbox(id: string, scene: Scene): Mesh {
    // Head Hitbox - positioned relative to root
    const headBox = MeshBuilder.CreateBox('headBox_' + id, { size: 0.25 }, scene);
    headBox.parent = this.mesh;

    // Adjust this value to match the visual mesh's head bone position
    // If root is 2m tall centered at 1m, top is at 2m. Head is likely near 1.75m.
    // Relative position = 1.75 - 1.0 = 0.75
    headBox.position = new Vector3(0, 1.75, 0);
    headBox.checkCollisions = true;
    headBox.isPickable = true;
    headBox.metadata = { type: 'enemy', id: this.id, bodyPart: 'head', pawn: this };

    return headBox;
  }

  // ============================================
  // Component Creation
  // ============================================

  private createHealthComponent(config: CompositionalEnemyPawnConfig): HealthComponent {
    return new HealthComponent({
      maxHealth: config.maxHealth,
      initialHealth: config.initialHealth ?? config.maxHealth,
    });
  }

  private createMovementComponent(
    scene: Scene,
    config: CompositionalEnemyPawnConfig
  ): MovementComponent {
    return new MovementComponent(scene, {
      walkSpeed: config.walkSpeed,
      runSpeed: config.runSpeed,
      acceleration: config.acceleration ?? 10,
      deceleration: config.deceleration ?? 8,
      rotationSpeed: 5,
      canFly: false,
    });
  }

  private createAIComponent(scene: Scene, config: CompositionalEnemyPawnConfig): AIComponent {
    return new AIComponent(scene, {
      detectionRange: config.detectionRange,
      attackRange: config.attackRange,
      patrolRadius: config.patrolRadius ?? 5,
      patrolWaitTime: config.patrolWaitTime ?? 2,
      attackCooldown: config.attackCooldown ?? 1,
    });
  }

  // ============================================
  // Event Setup
  // ============================================

  private setupHealthEvents(): void {
    // Handle death
    this.healthComponent.onDeath.add((event) => {
      logger.info(`CompositionalEnemyPawn ${this.id} died. Killer: ${event.killerId ?? 'unknown'}`);
      this.aiComponent.onDeath();
      this.onDeath();
    });

    // Handle damage
    this.healthComponent.onDamageTaken.add((event) => {
      logger.debug(
        `CompositionalEnemyPawn ${this.id} took ${event.amount} damage from ${event.attackerId ?? 'unknown'}`
      );
      this.onTakeDamage(event.amount, event.attackerId);
    });
  }

  // ============================================
  // Lifecycle
  // ============================================

  public override activate(): void {
    super.activate();
    logger.debug(`Activated CompositionalEnemyPawn ${this.id}`);
  }

  public override deactivate(): void {
    super.deactivate();
    logger.debug(`Deactivated CompositionalEnemyPawn ${this.id}`);
  }

  public override dispose(): void {
    // Components are disposed by base Pawn.dispose()
    super.dispose();

    // Dispose additional meshes
    if (this.headBox && !this.headBox.isDisposed()) {
      this.headBox.dispose();
    }

    logger.debug(`Disposed CompositionalEnemyPawn ${this.id}`);
  }

  // ============================================
  // IEnemyPawn Implementation
  // ============================================

  /**
   * Rotate to face a target point
   */
  public lookAt(targetPoint: Vector3): void {
    this.movementComponent.lookAt(targetPoint);
  }

  /**
   * Move in a direction (used by external controllers)
   */
  public move(direction: Vector3, speed: number, _deltaTime: number): void {
    this.movementComponent.move(direction, speed);
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Set the target provider function for AI
   * The provider should return the current target or null
   */
  public setTargetProvider(provider: () => AITarget | null): void {
    this.aiComponent.setTargetProvider(provider);
  }

  /**
   * Set AI behavior callbacks
   */
  public setBehaviorCallbacks(callbacks: AIBehaviorCallbacks): void {
    this.aiComponent.setBehaviorCallbacks(callbacks);
  }

  /**
   * Force the AI to target a specific entity
   */
  public forceTarget(target: AITarget): void {
    this.aiComponent.forceTarget(target);
  }

  /**
   * Clear the current target
   */
  public clearTarget(): void {
    this.aiComponent.clearTarget();
  }

  /**
   * Get current AI state
   */
  public getAIState(): string {
    return this.aiComponent.getCurrentState();
  }

  /**
   * Get current target
   */
  public getCurrentTarget(): AITarget | null {
    return this.aiComponent.getCurrentTarget();
  }

  /**
   * Get distance to current target
   */
  public getDistanceToTarget(): number {
    return this.aiComponent.getDistanceToTarget();
  }

  /**
   * Check if the pawn is moving
   */
  public isMoving(): boolean {
    return this.movementComponent.getIsMoving();
  }

  /**
   * Get current velocity
   */
  public getVelocity(): Vector3 {
    return this.movementComponent.getVelocity();
  }

  /**
   * Get current speed
   */
  public getSpeed(): number {
    return this.movementComponent.getSpeed();
  }

  // ============================================
  // Event Handlers
  // ============================================

  protected onTakeDamage(amount: number, attackerId?: string): void {
    // Override in subclass or set callback for custom behavior
    // Example: Alert nearby enemies, play sound, etc.
    logger.debug(`Enemy ${this.id} took ${amount} damage from ${attackerId ?? 'unknown'}`);
  }

  protected onDeath(): void {
    // Override in subclass or set callback for custom behavior
    // Example: Spawn loot, update score, etc.
    logger.info(`Enemy ${this.id} died`);
  }

  // ============================================
  // Convenience Getters
  // ============================================

  /**
   * Get the pawn's configuration
   */
  public getConfig(): CompositionalEnemyPawnConfig {
    return this.config;
  }

  public get health(): number {
    return this.healthComponent.health;
  }

  public get maxHealth(): number {
    return this.healthComponent.maxHealth;
  }

  public get isDead(): boolean {
    return this.healthComponent.isDead;
  }

  public override takeDamage(
    amount: number,
    attackerId?: string,
    part?: string,
    hitPoint?: { x: number; y: number; z: number }
  ): void {
    this.healthComponent.takeDamage(amount, attackerId, part, hitPoint);
  }
}
