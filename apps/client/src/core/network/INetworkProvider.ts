import { NetworkState, RoomInfo, PlayerInfo } from '@ante/common';
import { OutboundTransportEvent, InboundTransportEvent } from '@ante/game-core';

/** 방 생성 옵션 */
export interface CreateRoomOptions {
  maxPlayers?: number;
  isVisible?: boolean;
  isOpen?: boolean;
  customGameProperties?: Record<string, unknown>;
  propsListedInLobby?: string[];
  [key: string]: unknown;
}

export type NetworkProviderEvent =
  | { type: 'stateChanged'; state: NetworkState }
  | { type: 'roomListUpdated'; rooms: RoomInfo[] }
  | { type: 'playerJoined'; user: PlayerInfo }
  | { type: 'playerLeft'; userId: string }
  | { type: 'masterClientSwitched'; newMasterId: string }
  | { type: 'transport'; event: InboundTransportEvent };

export type NetworkProviderSubscriber = (event: NetworkProviderEvent) => void;

export interface INetworkProvider {
  // Methods
  connect(userId: string): Promise<boolean>;
  disconnect(): void;
  leaveRoom(): void;

  createRoom(name: string, options?: CreateRoomOptions): Promise<boolean>;
  joinRoom(roomId: string): Promise<boolean>;
  getRoomList(): Promise<RoomInfo[]>;
  publish(event: OutboundTransportEvent): void;
  subscribe(handler: NetworkProviderSubscriber): () => void;
  getLocalPlayerId(): string | null;
  getServerTime(): number;

  // Additional methods used by NetworkManager
  isMasterClient(): boolean;
  getActors(): Map<string, { id: string; name: string }>;
  getCurrentRoomProperty<T = unknown>(key: string): T | null | undefined;
  refreshRoomList?(): void;
  getCurrentRoomName?(): string | null;
}
