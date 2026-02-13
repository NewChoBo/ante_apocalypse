import { EventCode, NetworkEventMap } from '@ante/common';

/**
 * Interface for network authority implementations.
 * Both Client (NetworkManager) and Server (ServerNetworkAuthority) implement this.
 */
export interface INetworkAuthority {
  // Core authority check
  isMasterClient(): boolean;
  getSocketId(): string | undefined;

  // Event communication
  sendEvent<K extends EventCode>(code: K, data: NetworkEventMap[K], reliable?: boolean): void;
  sendEvent(code: number, data: unknown, reliable?: boolean): void;

  // Lifecycle (optional for implementations that manage connection externally)
  connect?(idOrRegion: string): Promise<boolean | void>;
  disconnect?(): void;

  // Room management (optional)
  createRoom?(name: string, mapIdOrOptions: string | Record<string, unknown>): Promise<boolean | void>;
  joinRoom?(name: string): Promise<boolean | void>;

  // State queries (optional)
  getServerTime?(): number;
}
