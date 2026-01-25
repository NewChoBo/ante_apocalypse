import { RoomInfo, NetworkState } from './NetworkProtocol';

export interface INetworkProvider {
  // Methods
  connect(userId: string): Promise<boolean>;
  disconnect(): void;
  createRoom(name: string, options?: { mapId: string }): Promise<boolean>;
  joinRoom(name: string): Promise<boolean>;
  leaveRoom(): void;
  sendEvent(code: number, data: any, reliable?: boolean): void;
  getCurrentRoomProperty(key: string): any;

  // Event Listeners (Setters for callbacks)
  onStateChanged: ((state: NetworkState) => void) | null;
  onRoomListUpdated: ((rooms: RoomInfo[]) => void) | null;
  onEvent: ((code: number, data: any, senderId: string) => void) | null;
  onPlayerJoined: ((id: string, name: string) => void) | null;
  onPlayerLeft: ((id: string) => void) | null;
}
