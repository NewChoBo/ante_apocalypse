/**
 * Pawn - Composition-based entity container
 *
 * This class replaces the inheritance-heavy BasePawn hierarchy
 * with a composition-based approach where functionality is
 * provided by attached components.
 *
 * Migration path from inheritance:
 * 1. CharacterPawn/EnemyPawn extend Pawn instead of BasePawn
 * 2. Extract functionality into components (HealthComponent, etc.)
 * 3. Components are added via addComponent()
 * 4. Pawn.tick() calls component.update() for all components
 */

import { Mesh, AbstractMesh, Vector3, Scene } from '@babylonjs/core';
import { IPawn, IPawnComponent, EntityId, EntityType } from '@ante/common';
import { TickManager } from '../systems/TickManager.js';
import { Logger } from '@ante/common';

const logger = new Logger('Pawn');

/**
 * Pawn configuration options
 */
export interface PawnOptions {
  id?: EntityId;
  type: EntityType;
  position?: Vector3;
  rotation?: Vector3;
  maxHealth?: number;
  initialHealth?: number;
}

/**
 * Composition-based Pawn implementation
 *
 * Usage:
 * ```typescript
 * const pawn = new Pawn(scene, { type: 'enemy', position: new Vector3(0, 0, 0) });
 * pawn.addComponent(new HealthComponent({ maxHealth: 100 }));
 * pawn.addComponent(new MovementComponent({ speed: 5 }));
 * ```
 */
export class Pawn implements IPawn {
  public readonly priority = 20; // ITickable priority
  // Identity
  public readonly id: EntityId;
  public readonly type: EntityType;

  // Transform
  public mesh: Mesh | AbstractMesh;
  private _position: Vector3;
  private _rotation: Vector3;

  // State
  public isActive = false;
  private _health = 100;
  private _maxHealth = 100;
  private _isDead = false;

  // Components
  private components: Map<string, IPawnComponent<IPawn>> = new Map();
  private componentsByType: Map<string, IPawnComponent<IPawn>[]> = new Map();

  // Scene reference
  protected scene: Scene;

  constructor(scene: Scene, options: PawnOptions) {
    this.scene = scene;
    this.id = options.id ?? `pawn_${Math.random().toString(36).substr(2, 9)}`;
    this.type = options.type;
    this._position = options.position ?? new Vector3(0, 0, 0);
    this._rotation = options.rotation ?? new Vector3(0, 0, 0);
    this._maxHealth = options.maxHealth ?? 100;
    this._health = options.initialHealth ?? this._maxHealth;

    // Create placeholder mesh (subclasses should replace this)
    this.mesh = new Mesh(`pawn_mesh_${this.id}`, scene);
    this.mesh.position.copyFrom(this._position);
    this.mesh.rotation.copyFrom(this._rotation);

    logger.debug(`Created Pawn ${this.id} of type ${this.type}`);
  }

  // ============================================
  // IPawn Implementation - Transform
  // ============================================

  public get position(): Vector3 {
    return this.mesh.position;
  }

  public set position(value: Vector3) {
    this.mesh.position.copyFrom(value);
    this._position.copyFrom(value);
  }

  public get rotation(): Vector3 {
    return this.mesh.rotation;
  }

  public set rotation(value: Vector3) {
    this.mesh.rotation.copyFrom(value);
    this._rotation.copyFrom(value);
  }

  // ============================================
  // IPawn Implementation - Health
  // ============================================

  public get health(): number {
    // Delegate to HealthComponent if present
    const healthComponent = this.getComponent('HealthComponent') as { health: number } | undefined;
    if (healthComponent) {
      return healthComponent.health;
    }
    return this._health;
  }

  public set health(value: number) {
    this._health = Math.max(0, Math.min(this._maxHealth, value));
  }

  public get maxHealth(): number {
    const healthComponent = this.getComponent('HealthComponent') as
      | { maxHealth: number }
      | undefined;
    if (healthComponent) {
      return healthComponent.maxHealth;
    }
    return this._maxHealth;
  }

  public get isDead(): boolean {
    const healthComponent = this.getComponent('HealthComponent') as { isDead: boolean } | undefined;
    if (healthComponent) {
      return healthComponent.isDead;
    }
    return this._isDead;
  }

  // ============================================
  // IPawn Implementation - Components
  // ============================================

  public addComponent(component: IPawnComponent): void {
    if (this.components.has(component.componentId)) {
      logger.warn(`Component ${component.componentId} already exists on pawn ${this.id}`);
      return;
    }

    this.components.set(component.componentId, component);

    // Index by type for faster lookups
    const typeList = this.componentsByType.get(component.componentType) ?? [];
    typeList.push(component);
    this.componentsByType.set(component.componentType, typeList);

    // Attach to pawn
    component.onAttach(this);

    logger.debug(`Added component ${component.componentType} to pawn ${this.id}`);
  }

  public removeComponent(componentId: string): void {
    const component = this.components.get(componentId);
    if (!component) {
      logger.warn(`Component ${componentId} not found on pawn ${this.id}`);
      return;
    }

    // Remove from type index
    const typeList = this.componentsByType.get(component.componentType);
    if (typeList) {
      const index = typeList.indexOf(component);
      if (index > -1) {
        typeList.splice(index, 1);
      }
    }

    // Detach and remove
    component.onDetach();
    this.components.delete(componentId);

    logger.debug(`Removed component ${component.componentType} from pawn ${this.id}`);
  }

  public getComponent<T>(type: string): T | undefined {
    const typeList = this.componentsByType.get(type);
    if (typeList && typeList.length > 0) {
      return typeList[0] as unknown as T;
    }
    return undefined;
  }

  public getAllComponents(): IPawnComponent<IPawn>[] {
    return Array.from(this.components.values());
  }

  public hasComponent(type: string): boolean {
    const typeList = this.componentsByType.get(type);
    return typeList !== undefined && typeList.length > 0;
  }

  // ============================================
  // IPawn Implementation - Lifecycle
  // ============================================

  public activate(): void {
    if (this.isActive) return;
    this.isActive = true;
    TickManager.getInstance().register(this);
    logger.debug(`Activated pawn ${this.id}`);
  }

  public deactivate(): void {
    if (!this.isActive) return;
    this.isActive = false;
    TickManager.getInstance().unregister(this);
    logger.debug(`Deactivated pawn ${this.id}`);
  }

  public tick(deltaTime: number): void {
    if (!this.isActive) return;

    // Update all active components
    for (const component of this.components.values()) {
      if (component.isActive) {
        component.update(deltaTime);
      }
    }
  }

  public dispose(): void {
    this.deactivate();

    // Dispose all components
    for (const component of this.components.values()) {
      component.dispose();
    }
    this.components.clear();
    this.componentsByType.clear();

    // Dispose mesh
    if (this.mesh && !this.mesh.isDisposed()) {
      this.mesh.dispose();
    }

    logger.debug(`Disposed pawn ${this.id}`);
  }

  // ============================================
  // IPawn Implementation - Combat
  // ============================================

  public takeDamage(
    amount: number,
    attackerId?: string,
    part?: string,
    hitPoint?: { x: number; y: number; z: number }
  ): void {
    // Delegate to HealthComponent if present
    const healthComponent = this.getComponent('HealthComponent') as
      | {
          takeDamage(
            amount: number,
            attackerId?: string,
            part?: string,
            hitPoint?: { x: number; y: number; z: number }
          ): void;
        }
      | undefined;

    if (healthComponent) {
      healthComponent.takeDamage(amount, attackerId, part, hitPoint);
    } else {
      // Fallback to basic implementation
      this._health = Math.max(0, this._health - amount);
      if (this._health <= 0 && !this._isDead) {
        this.die(attackerId);
      }
    }
  }

  public die(killerId?: string): void {
    if (this._isDead) return;

    // Delegate to HealthComponent if present
    const healthComponent = this.getComponent('HealthComponent') as
      | {
          die(killerId?: string): void;
          isDead: boolean;
        }
      | undefined;

    if (healthComponent) {
      healthComponent.die(killerId);
      this._isDead = healthComponent.isDead;
    } else {
      this._isDead = true;
      this._health = 0;
    }

    logger.debug(`Pawn ${this.id} died${killerId ? ` (killer: ${killerId})` : ''}`);
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Get components of a specific type (returns all matching, not just first)
   */
  public getComponentsOfType<T extends IPawnComponent>(type: string): T[] {
    return (this.componentsByType.get(type) ?? []) as T[];
  }

  /**
   * Check if pawn is disposed
   */
  public isDisposed(): boolean {
    return this.mesh.isDisposed();
  }
}
