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

export interface RoomInfo {
  id: string; // Changed from name to id for consistency
  name: string; // Added for UI compatibility
  maxPlayers: number;
  playerCount: number;
  customProperties?: any;
  isOpen: boolean;
}

export interface PlayerInfo {
  userId: string;
  isMaster: boolean;
  name?: string; // Added optional name
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
  rotation?: { x: number; y: number; z: number; w: number };
  state?: string;
  weaponId?: string; // Added
  health?: number; // Added
  [key: string]: any;
}

export interface EnemyUpdateData {
  id: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number; w: number };
  state?: string;
  isMoving?: boolean; // Added for sync
}

export interface EnemySpawnData {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  targetId?: string;
}

export interface EnemyDestroyData {
  id: string;
}

export interface TargetSpawnData {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  isMoving: boolean;
}

export interface TargetDestroyData {
  id: string;
  targetId?: string; // Handle potential inconsistent naming
}

export interface PickupSpawnData {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
}

export interface PickupDestroyData {
  id: string;
}
