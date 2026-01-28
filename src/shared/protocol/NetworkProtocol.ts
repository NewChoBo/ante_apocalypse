export enum EventCode {
  // System Events
  JOIN = 1,
  LEAVE = 2,
  MOVE = 3,
  SYNC_WEAPON = 7,
  ENEMY_MOVE = 9,
  TARGET_DESTROY = 11,
  SPAWN_TARGET = 12,
  REQ_INITIAL_STATE = 13,
  INITIAL_STATE = 14,

  // [S -> C] Enemy Lifecycle
  ON_ENEMY_SPAWN = 16,
  ON_ENEMY_DESTROY = 17,

  SPAWN_PICKUP = 18,
  DESTROY_PICKUP = 19,

  // [C -> S] Requests
  REQ_FIRE = 101,
  REQ_HIT = 102,
  REQ_TRY_PICKUP = 103,
  REQ_RELOAD = 104,
  REQ_USE_ITEM = 105,
  REQ_SWITCH_WEAPON = 106,
  REQ_READY = 107,

  // [S -> C] Notifications
  ON_STATE_SYNC = 200,
  ON_FIRED = 201,
  ON_HIT = 202,
  ON_DIED = 203,
  ON_ITEM_PICKED = 204,
  ON_AMMO_SYNC = 205,
  ON_MATCH_STATE_SYNC = 206,
  ON_MATCH_END = 207,
  ON_SCORE_SYNC = 208,
  ON_POS_CORRECTION = 209,
  ON_STATE_DELTA = 210,
  ON_PLAYER_RESPAWN = 211,
}

export class RoomData {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly maxPlayers: number,
    public readonly playerCount: number,
    public readonly isOpen: boolean,
    public readonly customProperties: Record<string, unknown> = {}
  ) {}
}

export class PlayerDataModel {
  constructor(
    public readonly userId: string,
    public readonly isMaster: boolean,
    public readonly name?: string
  ) {}
}

export enum NetworkState {
  Disconnected = 'Disconnected',
  Connecting = 'Connecting',
  ConnectedToMaster = 'ConnectedToMaster',
  InLobby = 'InLobby',
  InRoom = 'InRoom',
  Error = 'Error',
}

export interface PlayerData {
  id: string;
  userId?: string;
  name?: string;
  isMaster?: boolean;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number; w?: number };
  state?: string;
  weaponId?: string;
  health?: number;
  [key: string]: unknown;
}

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Rotation {
  x: number;
  y: number;
  z: number;
  w?: number;
}

export class MovePayload {
  constructor(
    public readonly position: Position,
    public readonly rotation: Rotation,
    public readonly velocity?: Position,
    public readonly weaponId?: string
  ) {}
}

// --- Protocol for Logical Server ---

// [REQ] Fire
export class ReqFirePayload {
  constructor(
    public readonly weaponId: string,
    public readonly muzzleData?: {
      position: Position;
      direction: Position;
    }
  ) {}
}

// [ON] Fired (Broadcast to all)
export class OnFiredPayload {
  constructor(
    public readonly shooterId: string,
    public readonly weaponId: string,
    public readonly muzzleData?: {
      position: Position;
      direction: Position;
    },
    public readonly ammoRemaining?: number
  ) {}
}

// [REQ] Reload
export class ReqReloadPayload {
  constructor(public readonly weaponId: string) {}
}

// [REQ] Hit
export class ReqHitPayload {
  constructor(
    public readonly targetId: string,
    public readonly damage: number,
    public readonly hitPosition: Position,
    public readonly timestamp: number = Date.now(), // Auto-assign if not provided
    public readonly hitNormal?: Position
  ) {}
}

// [ON] Hit (Confirmed) - Previously used, ensuring it matches new needs
export class OnHitPayload {
  constructor(
    public readonly targetId: string,
    public readonly damage: number,
    public readonly remainingHealth: number,
    public readonly shooterId?: string, // Optional info
    public readonly hitPosition?: Position,
    public readonly hitNormal?: Position
  ) {}
}

// [ON] Died
export class OnDiedPayload {
  constructor(
    public readonly victimId: string,
    public readonly killerId?: string,
    public readonly reason?: string
  ) {}
}

// [ON] State Sync (Full World State)
export class OnStateSyncPayload {
  constructor(
    public readonly timestamp: number,
    public readonly players: PlayerData[],
    public readonly enemies: EnemyUpdateData[] = [],
    public readonly targets: TargetSpawnData[] = [],
    public readonly pickups: PickupSpawnData[] = []
  ) {}
}

// [ON] Match State Sync
export class OnMatchStateSyncPayload {
  constructor(
    public readonly state: 'READY' | 'PLAYING' | 'GAME_OVER',
    public readonly timeFormatted: string,
    public readonly remainingSeconds: number
  ) {}
}

// [ON] Match End
export class OnMatchEndPayload {
  constructor(
    public readonly isWin: boolean,
    public readonly winnerId?: string,
    public readonly finalScores?: Record<string, number>
  ) {}
}

// [ON] Score Sync
export class OnScoreSyncPayload {
  constructor(
    public readonly scores: Record<string, number>,
    public readonly totalScore?: number
  ) {}
}

// [ON] Position Correction (Rubberbanding)
export class OnPosCorrectionPayload {
  constructor(
    public readonly position: Position,
    public readonly rotation?: Rotation,
    public readonly sequence?: number
  ) {}
}

// [ON] State Delta Sync
export class OnStateDeltaPayload {
  constructor(
    public readonly timestamp: number,
    public readonly changedPlayers: Partial<PlayerData>[],
    public readonly changedEnemies: Partial<EnemyUpdateData>[],
    public readonly changedTargets: Partial<TargetSpawnData>[]
  ) {}
}

// [ON] Ammo Sync (Private or Public)
export class OnAmmoSyncPayload {
  constructor(
    public readonly weaponId: string,
    public readonly currentAmmo: number,
    public readonly reserveAmmo: number
  ) {}
}

export class SyncWeaponPayload {
  constructor(public readonly weaponId: string) {}
}

export class EnemyUpdateData {
  constructor(
    public readonly id: string,
    public readonly position: Position,
    public readonly rotation?: Rotation,
    public readonly state?: string,
    public readonly isMoving?: boolean,
    public readonly health?: number
  ) {}
}

export class EnemySpawnData {
  constructor(
    public readonly id: string,
    public readonly type: string,
    public readonly position: Position,
    public readonly targetId?: string
  ) {}
}

export class EnemyDestroyData {
  constructor(public readonly id: string) {}
}

export class TargetSpawnData {
  constructor(
    public readonly id: string,
    public readonly type: string,
    public readonly position: Position,
    public readonly isMoving: boolean
  ) {}
}

export class TargetDestroyData {
  constructor(
    public readonly id: string,
    public readonly targetId?: string
  ) {}
}

export class PickupSpawnData {
  constructor(
    public readonly id: string,
    public readonly type: string,
    public readonly position: Position
  ) {}
}

export class PickupDestroyData {
  constructor(public readonly id: string) {}
}

export class ReqInitialStatePayload {
  constructor(public readonly senderId?: string) {}
}

export class InitialStatePayload {
  constructor(
    public readonly players: PlayerData[],
    public readonly enemies: EnemyUpdateData[],
    public readonly targets?: TargetSpawnData[]
  ) {}
}

export class PlayerDeathPayload {
  constructor(
    public readonly playerId: string,
    public readonly attackerId: string
  ) {}
}

export class OnPlayerRespawnPayload {
  constructor(
    public readonly playerId: string,
    public readonly position: Position
  ) {}
}

export class ReqTryPickupPayload {
  constructor(
    public readonly id: string,
    public readonly position: Position
  ) {}
}

export class ReqUseItemPayload {
  constructor(
    public readonly itemId: string,
    public readonly itemType: string
  ) {}
}

export class ReqSwitchWeaponPayload {
  constructor(public readonly weaponId: string) {}
}

export class OnItemPickedPayload {
  constructor(
    public readonly id: string,
    public readonly type: string,
    public readonly ownerId: string
  ) {}
}

export type EventData =
  | MovePayload
  | ReqFirePayload
  | OnFiredPayload
  | OnAmmoSyncPayload
  | ReqReloadPayload
  | ReqHitPayload
  | OnHitPayload
  | OnDiedPayload
  | OnStateSyncPayload
  | SyncWeaponPayload
  | EnemySpawnData
  | EnemyDestroyData
  | PickupSpawnData
  | PickupDestroyData
  | TargetSpawnData
  | TargetDestroyData
  | ReqInitialStatePayload
  | InitialStatePayload
  | PlayerDeathPayload
  | EnemyUpdateData
  | PlayerData
  | ReqTryPickupPayload
  | OnItemPickedPayload
  | OnMatchStateSyncPayload
  | OnMatchEndPayload
  | OnScoreSyncPayload
  | OnPosCorrectionPayload
  | ReqUseItemPayload
  | ReqSwitchWeaponPayload
  | OnStateDeltaPayload
  | OnPlayerRespawnPayload;
