import { RoomInfo, NetworkState, PlayerInfo, EventData } from './NetworkProtocol';

export interface INetworkProvider {
  // Methods
  connect(userId: string): Promise<boolean>;
  disconnect(): void;
  createRoom(options: { roomName?: string; mapId: string; maxPlayers: number }): Promise<boolean>;
  joinRoom(roomId: string): Promise<boolean>;
  getRoomList(): Promise<RoomInfo[]>;
  sendEvent(code: number, data: EventData, reliable: boolean): void;
  getLocalPlayerId(): string | null;
  getServerTime(): number;
  getCurrentRoomProperty(key: string): unknown;
  getActors(): Map<string, { id: string; name: string }>;
  isMasterClient(): boolean;
  refreshRoomList?(): void;

  // Event Handlers (Setters)
  onStateChanged?: (state: NetworkState) => void;
  onEvent?: (code: number, data: EventData, senderId: string) => void;
  onPlayerJoined?: (user: PlayerInfo) => void;
  onPlayerLeft?: (userId: string) => void;
  onRoomListUpdated?: (rooms: RoomInfo[]) => void;
}
