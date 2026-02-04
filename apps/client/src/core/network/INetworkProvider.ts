import { NetworkState, RoomInfo, PlayerInfo } from '@ante/common';

/** 방 생성 옵션 */
export interface CreateRoomOptions {
  maxPlayers?: number;
  isVisible?: boolean;
  isOpen?: boolean;
  customRoomProperties?: Record<string, unknown>;
  propsListedInLobby?: string[];
  [key: string]: unknown;
}

export interface INetworkProvider {
  // Methods
  connect(userId: string): Promise<boolean>;
  disconnect(): void;

  createRoom(name: string, options?: CreateRoomOptions): Promise<boolean>;
  joinRoom(roomId: string): Promise<boolean>;
  getRoomList(): Promise<RoomInfo[]>;
  sendEvent(code: number, data: unknown, reliable: boolean): void;
  getLocalPlayerId(): string | null;
  getServerTime(): number;

  // Additional methods used by NetworkManager
  isMasterClient(): boolean;
  getActors(): Map<string, { id: string; name: string }>;
  getCurrentRoomProperty(key: string): unknown;
  refreshRoomList?(): void;
  getCurrentRoomName?(): string | null;

  // Event Handlers (Setters)
  onStateChanged?: (state: NetworkState) => void;
  onEvent?: (code: number, data: unknown, senderId: string) => void;
  onPlayerJoined?: (user: PlayerInfo) => void;
  onPlayerLeft?: (userId: string) => void;
  onMasterClientSwitched?: (newMasterId: string) => void;
  onRoomListUpdated?: (rooms: RoomInfo[]) => void;
}
