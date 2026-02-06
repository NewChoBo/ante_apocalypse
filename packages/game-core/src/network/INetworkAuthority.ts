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
  // Lifecycle (optional for implementations that manage connection externally)
  connect?(...args: unknown[]): void | Promise<void | boolean>;
  disconnect?(): void | Promise<void>;

  // Room management (optional)
  createRoom?(...args: unknown[]): void | Promise<void | boolean>;
  joinRoom?(...args: unknown[]): void | Promise<void | boolean>;

  // State queries (optional)
  getServerTime?(): number;
}
