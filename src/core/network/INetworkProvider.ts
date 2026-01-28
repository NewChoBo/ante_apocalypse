import { NetworkState, RoomInfo, PlayerInfo } from './NetworkProtocol';

export interface INetworkProvider {
  // Methods
  connect(userId: string): Promise<boolean>;
  disconnect(): void;

  joinRoom(roomId: string): Promise<boolean>;
  getRoomList(): Promise<RoomInfo[]>;
  sendEvent(code: number, data: any, reliable: boolean): void;
  getLocalPlayerId(): string | null;
  getServerTime(): number;

  // Additional methods used by NetworkManager
  isMasterClient(): boolean;
  getActors(): Map<string, { id: string; name: string }>;
  getCurrentRoomProperty(key: string): any;
  refreshRoomList?(): void;

  // Event Handlers (Setters)
  onStateChanged?: (state: NetworkState) => void;
  onEvent?: (code: number, data: any, senderId: string) => void;
  onPlayerJoined?: (user: PlayerInfo) => void;
  onPlayerLeft?: (userId: string) => void;
  onRoomListUpdated?: (rooms: RoomInfo[]) => void;
}
