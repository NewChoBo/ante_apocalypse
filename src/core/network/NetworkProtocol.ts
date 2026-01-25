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
