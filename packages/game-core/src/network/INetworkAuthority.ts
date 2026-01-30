/**
 * Interface for network authority implementations.
 * Both Client (NetworkManager) and Server (ServerNetworkAuthority) implement this.
 */
export interface INetworkAuthority {
  // Core authority check
  isMasterClient(): boolean;
  getSocketId(): string | undefined;

  // Event communication
  sendEvent(code: number, data: unknown, reliable?: boolean): void;

  // Lifecycle (optional for implementations that manage connection externally)
  connect?(...args: any[]): any;
  disconnect?(): void;

  // Room management (optional)
  createRoom?(...args: any[]): any;
  joinRoom?(...args: any[]): any;

  // State queries (optional)
  getServerTime?(): number;
}
