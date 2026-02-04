/**
 * CharacterPawn - Composition-based character pawn
 *
 * This refactored version uses the new composition-based Pawn from @ante/game-core
 * and adds character-specific components like HealthComponent.
 *
 * Migration changes:
 * - Now extends the new Pawn class instead of old BasePawn
 * - Uses HealthComponent for health management instead of inherited logic
 * - Components will be migrated incrementally
 */

import {
  Mesh,
  Vector3,
  Scene,
  StandardMaterial,
  Color3,
  MeshBuilder,
  ShadowGenerator,
} from '@babylonjs/core';
import { Pawn, HealthComponent } from '@ante/game-core';
import { Logger } from '@ante/common';

const logger = new Logger('CharacterPawn');

export interface CharacterPawnConfig {
  assetKey: string;
  type: 'player' | 'enemy' | 'remote_player';
  position: Vector3;
  shadowGenerator: ShadowGenerator;
  healthBarStyle?: 'player' | 'enemy';
  showHealthBar?: boolean;
  maxHealth?: number;
}

/**
 * 캐릭터 Pawn의 공통 베이스 클래스 (Composition-based)
 * RemotePlayerPawn과 EnemyPawn이 상속받음
 */
export abstract class CharacterPawn extends Pawn {
  public mesh: Mesh;
  public isMoving = false;

  // Core components
  protected healthComponent: HealthComponent;

  protected config: CharacterPawnConfig;

  constructor(scene: Scene, config: CharacterPawnConfig) {
    super(scene, {
      type: config.type,
      position: config.position,
      maxHealth: config.maxHealth ?? 100,
    });

    this.config = config;

    // Create root collider (invisible)
    this.mesh = MeshBuilder.CreateBox(
      `${config.type}Root`,
      { width: 0.5, height: 2, depth: 0.5 },
      scene
    );
    this.mesh.setPivotPoint(new Vector3(0, -1, 0));
    this.mesh.position.copyFrom(config.position);
    this.mesh.checkCollisions = true;
    this.mesh.isVisible = false;
    this.mesh.metadata = { type: config.type, pawn: this };

    // Backward compatibility: expose damage profile
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).damageProfile = {
      multipliers: { head: 2.0, body: 1.0 },
      defaultMultiplier: 1.0,
    };

    // Health component (composition)
    this.healthComponent = new HealthComponent({
      maxHealth: config.maxHealth ?? 100,
      componentId: `health_${this.id}`,
    });
    this.addComponent(this.healthComponent);

    // Subscribe to health events
    this.healthComponent.onDamageTaken.add((event) => {
      this.onTakeDamage(event.amount, event.attackerId, event.part, event.hitPoint as Vector3);
    });

    this.healthComponent.onDeath.add(() => {
      this.onDeath();
    });

    logger.info(`Created CharacterPawn ${this.id} of type ${config.type}`);
  }

  public tick(deltaTime: number): void {
    const prevPosition = this.mesh.position.clone();

    // Update all components via parent
    super.tick(deltaTime);

    // Calculate velocity for animation
    const currentPosition = this.mesh.position;
    const velocity = currentPosition.subtract(prevPosition).scale(1 / deltaTime);
    this.isMoving = velocity.length() > 0.1;
  }

  /**
   * Apply damage - delegates to HealthComponent
   */
  public override takeDamage(
    amount: number,
    attackerId?: string,
    part?: string,
    hitPoint?: Vector3
  ): void {
    this.healthComponent.takeDamage(
      amount,
      attackerId,
      part,
      hitPoint as { x: number; y: number; z: number }
    );
  }

  /**
   * Called when damage is taken (via HealthComponent event)
   */
  protected onTakeDamage(
    _amount: number,
    _attackerId?: string,
    _part?: string,
    _hitPoint?: Vector3
  ): void {
    // Hit flash effect
    if (this.mesh.isVisible && this.mesh.material instanceof StandardMaterial) {
      this.mesh.material.emissiveColor = Color3.White();
      setTimeout((): void => {
        if (this.mesh.material instanceof StandardMaterial) {
          this.mesh.material.emissiveColor = Color3.Black();
        }
      }, 100);
    }
  }

  /**
   * Called when pawn dies (via HealthComponent event)
   */
  protected onDeath(): void {
    logger.info(`${this.config.type} died`);
    this.mesh.setEnabled(false);
  }

  public dispose(): void {
    super.dispose();
    if (this.mesh && !this.mesh.isDisposed()) {
      this.mesh.dispose();
    }
  }

  // Common getters/setters
  public get position(): Vector3 {
    return this.mesh.position;
  }

  public set position(value: Vector3) {
    this.mesh.position.copyFrom(value);
  }

  public isDisposed(): boolean {
    return this.mesh.isDisposed();
  }

  // Getters for backward compatibility
  public get health(): number {
    return this.healthComponent.health;
  }

  public get maxHealth(): number {
    return this.healthComponent.maxHealth;
  }

  public get isDead(): boolean {
    return this.healthComponent.isDead;
  }

  public initialize(_scene: Scene): void {
    // To be implemented by subclasses
  }

  /**
   * Update health bar display if available
   */
  public updateHealthBar(health: number): void {
    const healthBar =
      this.getComponent<import('./components/HealthBarComponent').HealthBarComponent>('HealthBar');
    if (healthBar) {
      healthBar.updateHealth(health);
    }
  }
}
