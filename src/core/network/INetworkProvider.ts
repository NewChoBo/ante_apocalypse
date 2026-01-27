import { RoomData, NetworkState, PlayerDataModel, EventData } from './NetworkProtocol';

export interface INetworkProvider {
  // Methods
  connect(userId: string): Promise<boolean>;
  disconnect(): void;
  leaveRoom(): void;
  createRoom(options: {
    roomName?: string;
    mapId: string;
    maxPlayers: number;
    gameMode: string;
  }): Promise<boolean>;
  joinRoom(roomId: string): Promise<boolean>;
  getRoomList(): Promise<RoomData[]>;
  sendEvent(
    code: number,
    data: EventData,
    reliable: boolean,
    target?: 'others' | 'all' | 'master'
  ): void;
  getLocalPlayerId(): string | null;
  getServerTime(): number;
  getCurrentRoomProperty(key: string): unknown;
  getActors(): Map<string, { id: string; name: string }>;
  isMasterClient(): boolean;
  refreshRoomList?(): void;

  // Event Handlers (Setters)
  onStateChanged?: (state: NetworkState) => void;
  onEvent?: (code: number, data: EventData, senderId: string) => void;
  onPlayerJoined?: (user: PlayerDataModel) => void;
  onPlayerLeft?: (userId: string) => void;
  onRoomListUpdated?: (rooms: RoomData[]) => void;
}
