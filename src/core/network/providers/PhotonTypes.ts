export interface IPhotonActor {
  actorNr: number;
  name: string;
  isLocal: boolean;
  setName(name: string): void;
  getCustomProperty(key: string): unknown;
}

export interface IPhotonRoom {
  name: string;
  isLocal: boolean;
  isOpen: boolean;
  isVisible: boolean;
  maxPlayers: number;
  playerCount: number;
  masterClientId: number;
  actors: { [key: number]: IPhotonActor };
  getCustomProperty(key: string): unknown;
  getCustomProperties(): Record<string, unknown>;
}

export interface IPhotonClient {
  myActor(): IPhotonActor;
  myRoom(): IPhotonRoom;
  isJoinedToRoom(): boolean;
  connectToRegionMaster(region: string): boolean;
  disconnect(): void;
  createRoom(roomName: string, options: unknown): boolean;
  joinRoom(roomName: string): boolean;
  leaveRoom(): void;
  availableRooms(): IPhotonRoom[];
  raiseEvent(eventCode: number, data: unknown, options: unknown): void;
  setUserId(userId: string): void;
  isInLobby(): boolean;
  state: number;

  onStateChange?: (state: number) => void;
  onRoomListUpdate?: (rooms: IPhotonRoom[]) => void;
  onEvent?: (code: number, content: unknown, actorNr: number) => void;
  onActorJoin?: (actor: IPhotonActor) => void;
  onActorLeave?: (actor: IPhotonActor) => void;
  onError?: (errorCode: number, errorMsg: string) => void;

  loadBalancingPeer?: {
    getServerTime(): number;
  };
}

export interface IPhotonNamespace {
  PhotonPeer: {
    setWebSocketImpl(impl: unknown): void;
  };
  ConnectionProtocol: {
    Wss: number;
    Ws: number;
  };
  LoadBalancing: {
    LoadBalancingClient: {
      new (protocol: number, appId: string, appVersion: string): IPhotonClient;
      State: {
        Uninitialized: number;
        Disconnected: number;
        ConnectingToNameServer: number;
        ConnectedToNameServer: number;
        ConnectingToMasterserver: number;
        ConnectedToMaster: number;
        JoinedLobby: number;
        ConnectingToGameserver: number;
        ConnectedToGameserver: number;
        Joined: number;
        Error: number;
      };
    };
    Constants: {
      ReceiverGroup: {
        Others: number;
        All: number;
        MasterClient: number;
      };
    };
  };
}
