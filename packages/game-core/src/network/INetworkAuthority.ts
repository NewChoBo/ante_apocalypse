import { EventCode } from '@ante/common';
import {
  RequestEventCode,
  RequestPayloadMap,
  AuthorityEventCode,
  AuthorityPayloadMap,
  SystemEventCode,
  SystemPayloadMap,
} from './contracts/TransportEvent.js';

export interface ConnectionSnapshot {
  isConnected: boolean;
  socketId?: string;
}

export interface RoomSnapshot {
  name?: string | null;
  mapId?: string | null;
  isMasterClient: boolean;
}

/**
 * Interface for network authority implementations.
 * Both Client (NetworkManager) and Server (ServerNetworkAuthority) implement this.
 */
export interface INetworkAuthority {
  // Core authority check
  isMasterClient(): boolean;
  getSocketId(): string | undefined;

  // Event communication
  sendRequest<K extends RequestEventCode>(
    code: K,
    data: RequestPayloadMap[K],
    reliable?: boolean
  ): void;
  sendRequest(code: number, data: unknown, reliable?: boolean): void;
  sendEvent<K extends AuthorityEventCode | SystemEventCode>(
    code: K,
    data: (AuthorityPayloadMap & SystemPayloadMap)[K],
    reliable?: boolean
  ): void;
  sendEvent(code: number, data: unknown, reliable?: boolean): void;
  sendEvent<K extends EventCode>(code: K, data: unknown, reliable?: boolean): void;

  // Lifecycle (optional for implementations that manage connection externally)
  connect?(idOrRegion: string): Promise<ConnectionSnapshot | boolean | void>;
  disconnect?(): void;

  // Room management (optional)
  createRoom?(
    name: string,
    mapIdOrOptions: string | Record<string, unknown>
  ): Promise<RoomSnapshot | boolean | void>;
  joinRoom?(name: string): Promise<RoomSnapshot | boolean | void>;

  // State queries (optional)
  getServerTime?(): number;
}
