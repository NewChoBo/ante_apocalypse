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
  REQ_WEAPON_CONFIGS = 21,
  WEAPON_CONFIGS = 22,
  REQUEST_HIT = 23,
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface RoomInfo {
  id: string; // Photon Room Name
  name: string;
  playerCount: number;
  maxPlayers: number;
  isOpen: boolean;
  customProperties?: any;
}

export interface PlayerInfo {
  userId: string;
  name: string;
  isMaster: boolean;
}

export interface PlayerState {
  id: string;
  position: Vector3;
  rotation: Vector3;
  weaponId: string;
  name: string;
  health: number;
}

export interface MovePayload {
  position: Vector3;
  rotation: Vector3;
  weaponId: string;
}

export interface FireEventData {
  playerId: string;
  weaponId: string;
  muzzleTransform?: {
    position: Vector3;
    direction: Vector3;
  };
}

export interface HitEventData {
  targetId: string;
  attackerId: string;
  damage: number;
  newHealth: number;
  part?: string;
}

export interface DeathEventData {
  targetId: string;
  attackerId: string;
}

export interface RequestHitData {
  targetId: string;
  damage: number;
  part?: string;
  weaponId: string;
}

export interface InitialStatePayload {
  players: PlayerState[];
  enemies: any[]; // To be typed later if needed
  targets?: any[];
  weaponConfigs?: Record<string, any>;
}

export interface SyncWeaponPayload {
  weaponId: string;
}

export interface EnemyMovePayload {
  id: string;
  position: Vector3;
  rotation: Vector3;
  isMoving?: boolean;
}

export interface EnemyHitPayload {
  id: string;
  damage: number;
}

export interface TargetHitPayload {
  targetId: string;
  part: string;
  damage: number;
}

export interface TargetDestroyPayload {
  targetId: string;
}

export interface SpawnTargetPayload {
  type: string;
  position: Vector3;
  id: string;
  isMoving: boolean;
}

export interface EnemyDestroyPayload {
  id: string;
}

export interface PickupDestroyPayload {
  id: string;
}

export enum NetworkState {
  Disconnected = 'Disconnected',
  Connecting = 'Connecting',
  ConnectedToMaster = 'ConnectedToMaster',
  InLobby = 'InLobby',
  InRoom = 'InRoom',
  Error = 'Error',
}
