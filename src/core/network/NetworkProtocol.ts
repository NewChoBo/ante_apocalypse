export enum EventCode {
  JOIN = 1,
  LEAVE = 2,
  MOVE = 3,
  ANIM_STATE = 4,
  FIRE = 5,
  HIT = 6,
  SYNC_WEAPON = 7,
  MAP_SYNC = 8,
  ENEMY_MOVE = 9,
  TARGET_HIT = 10,
  TARGET_DESTROY = 11,
  SPAWN_TARGET = 12,
  REQ_INITIAL_STATE = 13,
  INITIAL_STATE = 14,
  ENEMY_HIT = 15,
  SPAWN_ENEMY = 16,
  DESTROY_ENEMY = 17,
  SPAWN_PICKUP = 18,
  DESTROY_PICKUP = 19,
  PLAYER_DEATH = 20,
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

/** Legacy support interface if needed, but RoomData class is preferred */
export type RoomInfo = RoomData;

export class PlayerDataModel {
  constructor(
    public readonly userId: string,
    public readonly isMaster: boolean,
    public readonly name?: string
  ) {}
}

/** Legacy support interface */
export type PlayerInfo = PlayerDataModel;

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
  weaponId?: string; // Added
  health?: number; // Added
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
    public readonly velocity?: Position
  ) {}
}

export class FirePayload {
  constructor(
    public readonly weaponId: string,
    public readonly muzzleData?: {
      position: Position;
      direction: Position;
    }
  ) {}
}

export class HitPayload {
  constructor(
    public readonly targetId: string,
    public readonly damage: number,
    public readonly part?: string,
    public readonly position?: Position
  ) {}
}

export class AnimStatePayload {
  constructor(
    public readonly state: string,
    public readonly speed?: number
  ) {}
}

export class SyncWeaponPayload {
  constructor(public readonly weaponId: string) {}
}

export class MapSyncPayload {
  constructor(public readonly mapId: string) {}
}

export class EnemyUpdateData {
  constructor(
    public readonly id: string,
    public readonly position: Position,
    public readonly rotation?: Rotation,
    public readonly state?: string,
    public readonly isMoving?: boolean
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

export class EnemyHitPayload {
  constructor(
    public readonly id: string,
    public readonly damage: number
  ) {}
}

export class TargetHitPayload {
  constructor(
    public readonly targetId: string,
    public readonly part: string,
    public readonly damage: number
  ) {}
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

export type EventData =
  | MovePayload
  | FirePayload
  | HitPayload
  | AnimStatePayload
  | EnemySpawnData
  | EnemyDestroyData
  | PickupSpawnData
  | PickupDestroyData
  | SyncWeaponPayload
  | MapSyncPayload
  | EnemyHitPayload
  | TargetHitPayload
  | TargetSpawnData
  | TargetDestroyData
  | ReqInitialStatePayload
  | InitialStatePayload
  | PlayerDeathPayload
  | EnemyUpdateData
  | PlayerData;
