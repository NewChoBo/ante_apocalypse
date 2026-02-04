declare module 'photon-realtime' {
  export namespace LoadBalancing {
    export namespace Constants {
      export enum ReceiverGroup {
        Others = 0,
        All = 1,
        MasterClient = 2,
      }
    }
    export class LoadBalancingClient {
      constructor(protocol: number, appId: string, appVersion: string);
      static State: Record<string, number>;

      onStateChange: (state: number) => void;
      onEvent: (code: number, content: any, actorNr: number) => void;
      onActorJoin: (actor: any) => void;
      onActorLeave: (actor: any) => void;
      onRoomListUpdate: (rooms: any[]) => void;
      onError: (errorCode: number, errorMsg: string) => void;
      raiseEvent(code: number, data: any, options?: any): void;
      connectToRegionMaster(region: string): void;
      disconnect(): void;
      createRoom(name: string, options?: any): void;
      joinRoom(name: string, options?: any): void;
      leaveRoom(): void;
      isConnectedToMaster(): boolean;
      isInLobby(): boolean;
      isJoinedToRoom(): boolean;
      myActor(): any;
      myRoom(): any;
      loadBalancingPeer: { getServerTime(): number };
      availableRooms(): any[];
      setUserId(userId: string): void;
    }
  }
  export const ConnectionProtocol: {
    Wss: number;
    Ws: number;
  };
}
