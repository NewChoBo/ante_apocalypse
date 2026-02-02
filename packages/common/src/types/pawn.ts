/**
 * Pawn Component System Types
 *
 * This module defines types for a composition-based pawn architecture
 * that replaces the current inheritance-heavy structure.
 *
 * Current inheritance chain:
 *   BasePawn -> CharacterPawn -> EnemyPawn/PlayerPawn/RemotePlayerPawn
 *
 * Target architecture:
 *   Pawn (composition container) + PawnComponents
 */

import type { Vector3, EntityId, EntityType } from './index.js';

// ============================================
// Component System Core Types
// ============================================

/**
 * Component lifecycle interface
 * Uses generic P type for flexibility between IPawnCore and IPawn
 */
export interface IPawnComponent<P = unknown> {
  /** Unique component identifier */
  readonly componentId: string;

  /** Component type for lookups */
  readonly componentType: string;

  /** Whether component is active */
  isActive: boolean;

  /** Called when component is added to a pawn */
  onAttach(pawn: P): void;

  /** Called every frame */
  update(deltaTime: number): void;

  /** Called when component is removed from a pawn */
  onDetach(): void;

  /** Cleanup resources */
  dispose(): void;
}

/**
 * Pawn interface for composition-based architecture
 */
export interface IPawn {
  /** Unique entity identifier */
  readonly id: EntityId;

  /** Entity type classification */
  readonly type: EntityType;

  /** Main mesh for this pawn */
  mesh: unknown;

  /** Current position in world space */
  position: Vector3;

  /** Current rotation */
  rotation: Vector3;

  /** Current health */
  health: number;

  /** Maximum health */
  maxHealth: number;

  /** Death state */
  isDead: boolean;

  /** Whether pawn is active */
  isActive: boolean;

  /** Add a component to this pawn */
  addComponent(component: IPawnComponent): void;

  /** Remove a component from this pawn */
  removeComponent(componentId: string): void;

  /** Get component by type */
  getComponent<T extends IPawnComponent>(type: string): T | undefined;

  /** Get all components */
  getAllComponents(): IPawnComponent[];

  /** Check if pawn has component of given type */
  hasComponent(type: string): boolean;

  /** Apply damage to this pawn */
  takeDamage(amount: number, attackerId?: string, part?: string, hitPoint?: Vector3): void;

  /** Kill this pawn */
  die(): void;

  /** Update all components */
  tick(deltaTime: number): void;

  /** Cleanup all components and resources */
  dispose(): void;
}

// ============================================
// Component Configuration Types
// ============================================

/**
 * Health component configuration
 */
export interface HealthComponentConfig {
  maxHealth: number;
  initialHealth?: number;
  regenerateRate?: number;
  regenerateDelay?: number;
}

/**
 * Movement component configuration
 */
export interface MovementComponentConfig {
  walkSpeed: number;
  runSpeed: number;
  crouchSpeed: number;
  jumpForce?: number;
  gravity?: number;
  mass?: number;
}

/**
 * Animation component configuration
 */
export interface AnimationComponentConfig {
  assetKey: string;
  defaultAnimation?: string;
  blendSpeed?: number;
}

/**
 * AI component configuration
 */
export interface AIComponentConfig {
  behaviorTreeId: string;
  detectionRange: number;
  attackRange: number;
  patrolPoints?: Vector3[];
}

/**
 * Combat component configuration
 */
export interface CombatComponentConfig {
  damageProfile: {
    multipliers: Record<string, number>;
    defaultMultiplier: number;
  };
  hitReactionEnabled?: boolean;
}

// ============================================
// Component Event Types
// ============================================

/**
 * Event fired when pawn takes damage
 */
export interface DamageEvent {
  pawnId: EntityId;
  amount: number;
  attackerId?: EntityId;
  part?: string;
  hitPoint?: Vector3;
  remainingHealth: number;
}

/**
 * Event fired when pawn dies
 */
export interface DeathEvent {
  pawnId: EntityId;
  killerId?: EntityId;
  position: Vector3;
}

/**
 * Event fired when pawn health changes
 */
export interface HealthChangeEvent {
  pawnId: EntityId;
  oldHealth: number;
  newHealth: number;
  maxHealth: number;
}

// ============================================
// Pawn Factory Types
// ============================================

/**
 * Pawn construction blueprint
 */
export interface PawnBlueprint {
  id: EntityId;
  type: EntityType;
  position: Vector3;
  rotation?: Vector3;
  components: ComponentDefinition[];
}

/**
 * Component definition for blueprint
 */
export interface ComponentDefinition {
  type: string;
  config: Record<string, unknown>;
}

/**
 * Pawn factory interface
 */
export interface IPawnFactory {
  createPawn(blueprint: PawnBlueprint): IPawn;
  createFromTemplate(templateId: string, position: Vector3): IPawn;
}

// ============================================
// Migration Helper Types
// ============================================

/**
 * Legacy pawn interface for backward compatibility
 * during the migration from inheritance to composition
 */
export interface ILegacyPawn {
  id: string;
  type: string;
  mesh: unknown;
  health: number;
  isDead: boolean;

  // Legacy methods that will be deprecated
  initialize?(scene: unknown): void;
  tick?(deltaTime: number): void;
  dispose?(): void;
}

/**
 * Adapter interface for transitioning from inheritance to composition
 */
export interface ICompositionAdapter {
  /** Convert legacy pawn to composition-based pawn */
  adapt(legacyPawn: ILegacyPawn): IPawn;

  /** Check if pawn has been migrated */
  isMigrated(pawn: unknown): boolean;
}
