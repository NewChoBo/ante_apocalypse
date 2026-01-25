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
};
