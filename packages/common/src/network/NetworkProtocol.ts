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
  RELOAD = 24,
  RESPAWN = 25,
  GAME_END = 26,
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
  customProperties?: Record<string, unknown>;
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
  isDead?: boolean;
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
  respawnDelaySeconds?: number;
}

export interface RequestHitData {
  targetId: string;
  damage: number;
  part?: string;
  weaponId: string;
  origin: Vector3;
  direction: Vector3;
}

export interface ReloadEventData {
  playerId: string;
  weaponId: string;
}

export interface EnemyState {
  id: string;
  position: Vector3;
  rotation: Vector3;
  health: number;
  isDead: boolean;
}

export interface InitialStatePayload {
  players: PlayerState[];
  enemies: EnemyState[];
  targets?: SpawnTargetPayload[];
  weaponConfigs?: Record<string, unknown>;
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

export interface RespawnEventData {
  playerId: string;
  position: Vector3;
}

export interface GameEndEventData {
  winnerId?: string;
  winnerTeam?: string;
  reason: string;
}

export enum NetworkState {
  Disconnected = 'Disconnected',
  Connecting = 'Connecting',
  ConnectedToMaster = 'ConnectedToMaster',
  InLobby = 'InLobby',
  InRoom = 'InRoom',
  Error = 'Error',
}

/**
 * EventCode와 페이로드 정보의 매핑 인터페이스
 */
export interface NetworkEventMap {
  [EventCode.JOIN]: { userId: string; name?: string };
  [EventCode.LEAVE]: string; // userId
  [EventCode.MOVE]: MovePayload;
  [EventCode.ANIM_STATE]: { id: string; state: string };
  [EventCode.FIRE]: FireEventData;
  [EventCode.HIT]: HitEventData;
  [EventCode.SYNC_WEAPON]: SyncWeaponPayload;
  [EventCode.MAP_SYNC]: { mapId: string };
  [EventCode.ENEMY_MOVE]: EnemyMovePayload;
  [EventCode.TARGET_HIT]: TargetHitPayload;
  [EventCode.TARGET_DESTROY]: TargetDestroyPayload;
  [EventCode.SPAWN_TARGET]: SpawnTargetPayload;
  [EventCode.REQ_INITIAL_STATE]: Record<string, never>;
  [EventCode.INITIAL_STATE]: InitialStatePayload;
  [EventCode.ENEMY_HIT]: EnemyHitPayload;
  [EventCode.SPAWN_ENEMY]: EnemyState;
  [EventCode.DESTROY_ENEMY]: EnemyDestroyPayload;
  [EventCode.SPAWN_PICKUP]: { id: string; type: string; position: Vector3 };
  [EventCode.DESTROY_PICKUP]: PickupDestroyPayload;
  [EventCode.PLAYER_DEATH]: DeathEventData;
  [EventCode.REQ_WEAPON_CONFIGS]: Record<string, never>;
  [EventCode.WEAPON_CONFIGS]: { configs: Record<string, unknown> };
  [EventCode.REQUEST_HIT]: RequestHitData;
  [EventCode.RELOAD]: ReloadEventData;
  [EventCode.RESPAWN]: RespawnEventData;
  [EventCode.GAME_END]: GameEndEventData;
}
