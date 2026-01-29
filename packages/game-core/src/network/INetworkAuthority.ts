export interface INetworkAuthority {
  isMasterClient(): boolean;
  sendEvent(code: number, data: any, reliable?: boolean): void;
  getSocketId(): string | undefined;
}
