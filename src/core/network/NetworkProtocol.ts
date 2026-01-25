export interface RoomInfo {
  name: string;
  playerCount: number;
  maxPlayers: number;
  isOpen: boolean;
  customProperties?: any;
}

export enum NetworkState {
  Disconnected = 'Disconnected',
  Connecting = 'Connecting',
  ConnectedToMaster = 'ConnectedToMaster',
  InLobby = 'InLobby',
  InRoom = 'InRoom',
  Error = 'Error',
}

export const EventCode = {
  JOIN: 1,
  LEAVE: 2,
  MOVE: 10, // Position, Rotation
  FIRE: 20, // WeaponId, Origin, Direction
  HIT: 21, // TargetId, Damage
  SYNC_WEAPON: 30, // WeaponId
  ENEMY_MOVE: 40, // EnemyId, Position, Rotation
  ENEMY_HIT: 41, // EnemyId, Damage
  REQ_INITIAL_STATE: 100,
  INITIAL_STATE: 101, // List of players, List of enemies
};
