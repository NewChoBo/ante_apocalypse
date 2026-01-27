export interface IServerNetwork {
  sendEvent(code: number, data: any, reliable?: boolean, targetId?: string): void;

  // Observable-like interfaces for minimal coupling
  onEvent: { add: (callback: (payload: any) => void) => any };
  onPlayerJoined: { add: (callback: (player: { id: string; name?: string }) => void) => any };
  onPlayerLeft: { add: (callback: (id: string) => void) => any };
}
