export * from './network/NetworkProtocol.js';
export * from './utils/Logger.js';

// Re-export types with explicit naming to avoid conflicts
// Note: Vector3 from NetworkProtocol is the network-serializable version
export type {
  EntityId,
  EntityType,
  IWorldEntity,
  IPawnCore,
  Vector2,
  Transform,
  DamageProfile,
  FiringMode,
  WeaponStats,
  IWeaponData,
  IFirearmData,
  PawnConfig,
  CharacterPawnConfig,
  EnemyPawnConfig,
  GameModeId,
  RespawnAction,
  RespawnDecision,
  GameEndResult,
  TickPriority,
  ITickable,
  Optional,
  JSONValue,
  Result,
} from './types/index.js';

// Re-export pawn composition types
export type {
  IPawnComponent,
  IPawn,
  HealthComponentConfig,
  MovementComponentConfig,
  AnimationComponentConfig,
  AIComponentConfig,
  CombatComponentConfig,
  DamageEvent,
  DeathEvent,
  HealthChangeEvent,
  PawnBlueprint,
  ComponentDefinition,
  IPawnFactory,
  ILegacyPawn,
  ICompositionAdapter,
} from './types/pawn.js';
