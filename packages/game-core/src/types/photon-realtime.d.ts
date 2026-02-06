declare module 'photon-realtime' {
  export namespace LoadBalancing {
    export namespace Constants {
      export enum ReceiverGroup {
        Others = 0,
        All = 1,
        MasterClient = 2,
      }
    }

    export class Actor {
      actorNr: number;
      userId: string;
      name: string;
      isLocal: boolean;
      customProperties: { [key: string]: unknown };
      setName(name: string): void;
    }

    export class Room {
      name: string;
      isOpen: boolean;
      isVisible: boolean;
      maxPlayers: number;
      playerCount: number;
      masterClientId: number;
      actors: { [key: number]: Actor };
      customProperties: { [key: string]: unknown };
      getCustomProperty(key: string): unknown;
    }

    export class LoadBalancingClient {
      constructor(protocol: number, appId: string, appVersion: string);
      static State: Record<string, number>;

      onStateChange: (state: number) => void;
      onEvent: (code: number, content: unknown, actorNr: number) => void;
      onActorJoin: (actor: Actor) => void;
      onActorLeave: (actor: Actor) => void;
      onRoomListUpdate: (rooms: unknown[]) => void;
      onError: (errorCode: number, errorMsg: string) => void;
      raiseEvent(code: number, data: unknown, options?: unknown): void;
      connectToRegionMaster(region: string): void;
      disconnect(): void;
      createRoom(name: string, options?: unknown): void;
      joinRoom(name: string, options?: unknown): void;
      leaveRoom(): void;
      isConnectedToMaster(): boolean;
      isInLobby(): boolean;
      isJoinedToRoom(): boolean;
      myActor(): Actor;
      myRoom(): Room;
      loadBalancingPeer: { getServerTime(): number };
      availableRooms(): unknown[];
      setUserId(userId: string): void;
    }
  }

  export class PhotonPeer {
    static setWebSocketImpl(impl: unknown): void;
  }

  export const ConnectionProtocol: {
    Wss: number;
    Ws: number;
  };
}
