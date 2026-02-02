/**
 * Shared Type Definitions for Ante Apocalypse
 *
 * This module contains all shared types that are used across
 * apps/client, apps/server, and packages/game-core.
 *
 * Goal: Eliminate duplication and provide single source of truth
 * for cross-package type definitions.
 */

// ============================================
// Core Entity Types
// ============================================

/**
 * Unique identifier for entities in the game world
 */
export type EntityId = string;

/**
 * Entity type classification
 */
export type EntityType =
  | 'player'
  | 'remote_player'
  | 'enemy'
  | 'target'
  | 'pickup'
  | 'projectile'
  | 'environment';

/**
 * Base interface for all world entities
 */
export interface IWorldEntity {
  id: EntityId;
  type: EntityType;
  position: Vector3;
  rotation?: Vector3;
  isActive: boolean;
}

/**
 * Pawn core interface - minimal interface for component owners
 */
export interface IPawnCore extends IWorldEntity {
  health: number;
  maxHealth: number;
  isDead: boolean;
  addComponent(component: unknown): void;
  getComponent<T>(type: new (...args: unknown[]) => T): T | undefined;
  die(): void;
  takeDamage(amount: number, attackerId?: string, part?: string, hitPoint?: Vector3): void;
}

// ============================================
// Math/Geometry Types
// ============================================

/**
 * 3D Vector - Serializable version (no Babylon.js dependency)
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * 2D Vector
 */
export interface Vector2 {
  x: number;
  y: number;
}

/**
 * Transform (Position + Rotation)
 */
export interface Transform {
  position: Vector3;
  rotation: Vector3;
}

/**
 * Damage profile for hitbox multipliers
 */
export interface DamageProfile {
  multipliers: Record<string, number>;
  defaultMultiplier: number;
}

// ============================================
// Weapon Types
// ============================================

/**
 * Weapon firing modes
 */
export type FiringMode = 'semi' | 'auto' | 'burst';

/**
 * Weapon statistics - strictly typed replacement for Record<string, any>
 */
export interface WeaponStats {
  damage: number;
  range: number;
  fireRate: number;
  reloadTime: number;
  magazineSize: number;
  recoilForce: number;
  firingMode: FiringMode;
  movementSpeedMultiplier: number;
  aimFOV: number;
  [key: string]: number | string | boolean | undefined;
}

/**
 * Weapon data structure
 */
export interface IWeaponData {
  id: string;
  name: string;
  type: 'firearm' | 'melee';
  stats: WeaponStats;
}

/**
 * Firearm-specific data
 */
export interface IFirearmData extends IWeaponData {
  type: 'firearm';
  currentAmmo: number;
  reserveAmmo: number;
}

// ============================================
// Pawn/Character Types
// ============================================

/**
 * Pawn configuration options
 */
export interface PawnConfig {
  assetKey: string;
  type: EntityType;
  position: Vector3;
  maxHealth?: number;
  showHealthBar?: boolean;
}

/**
 * Character-specific pawn configuration
 */
export interface CharacterPawnConfig extends PawnConfig {
  type: 'player' | 'enemy' | 'remote_player';
  healthBarStyle?: 'player' | 'enemy';
}

/**
 * Enemy pawn configuration
 */
export interface EnemyPawnConfig extends PawnConfig {
  type: 'enemy';
  aiType?: string;
  patrolPoints?: Vector3[];
}

// ============================================
// Game Rule Types
// ============================================

/**
 * Game mode identifiers
 */
export type GameModeId = 'survival' | 'shooting_range' | 'deathmatch' | 'ctf';

/**
 * Respawn decision types
 */
export type RespawnAction = 'respawn' | 'spectate' | 'eliminate';

/**
 * Respawn decision returned by game rules
 */
export interface RespawnDecision {
  action: RespawnAction;
  delay?: number;
  position?: Vector3;
}

/**
 * Game end result
 */
export interface GameEndResult {
  winnerId?: string;
  winnerTeam?: string;
  reason: string;
}

// ============================================
// Tick/Update Types
// ============================================

/**
 * Tick priority levels (lower = earlier)
 */
export const TickPriority = {
  Input: 0,
  Physics: 10,
  Gameplay: 20,
  AI: 30,
  Animation: 40,
  Rendering: 50,
} as const;

export type TickPriorityValue = (typeof TickPriority)[keyof typeof TickPriority];

/**
 * Tickable interface for update loop
 */
export interface ITickable {
  priority: number;
  tick(deltaTime: number): void;
}

// ============================================
// Utility Types
// ============================================

/**
 * Optional properties type helper
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Strict type for JSON-serializable values
 */
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

/**
 * Result type for operations that can fail
 */
export interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}
