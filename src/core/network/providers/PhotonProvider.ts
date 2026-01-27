import * as Photon from 'photon-realtime';
import { INetworkProvider } from '../INetworkProvider';
import { RoomData, NetworkState, PlayerDataModel, EventData } from '../NetworkProtocol';
import { IPhotonClient, IPhotonRoom, IPhotonActor, IPhotonNamespace } from './PhotonTypes';

const PhotonTyped = Photon as unknown as IPhotonNamespace;

/**
 * Photon Realtime Cloud를 이용한 네트워크 프로바이더 구현체.
 */
export class PhotonProvider implements INetworkProvider {
  private client: IPhotonClient;
  private appId: string = import.meta.env.VITE_PHOTON_APP_ID || '';
  private appVersion: string = import.meta.env.VITE_PHOTON_APP_VERSION || '1.0';

  public onStateChanged?: (state: NetworkState) => void;
  public onRoomListUpdated?: (rooms: RoomData[]) => void;
  public onEvent?: (code: number, data: EventData, senderId: string) => void;
  public onPlayerJoined?: (user: PlayerDataModel) => void;
  public onPlayerLeft?: (userId: string) => void;

  constructor() {
    // browser 환경에서 require('ws') 에러 방지를 위해 WebSocket 구현체 재설정
    if (typeof window !== 'undefined' && PhotonTyped.PhotonPeer) {
      PhotonTyped.PhotonPeer.setWebSocketImpl(WebSocket);
    }

    if (!this.appId || this.appId === 'YOUR_APP_ID_HERE') {
      console.error(
        '[PhotonProvider] AppID is missing! Please set VITE_PHOTON_APP_ID in your .env file.'
      );
    }

    this.client = new PhotonTyped.LoadBalancing.LoadBalancingClient(
      PhotonTyped.ConnectionProtocol.Wss,
      this.appId,
      this.appVersion
    );

    this.setupListeners();
  }

  private setupListeners(): void {
    this.client.onStateChange = (state: number): void => {
      const mappedState = this.mapState(state);
      console.log(`[Photon] State changed: ${mappedState}`);

      // Auto-join lobby when connected to master
      this.onStateChanged?.(mappedState);

      if (mappedState === NetworkState.InLobby) {
        // Initial fetch with slight delay to ensure list is populated
        setTimeout(() => {
          this.updateRoomListFromClient();
        }, 500);
      }
    };

    this.client.onRoomListUpdate = (rooms: IPhotonRoom[]): void => {
      const roomInfos: RoomData[] = rooms.map((r: IPhotonRoom) => ({
        id: r.name,
        name: r.name,
        playerCount: r.playerCount,
        maxPlayers: r.maxPlayers,
        isOpen: r.isOpen,

        customProperties: r.getCustomProperties(),
      }));
      this.onRoomListUpdated?.(roomInfos);
    };

    this.client.onEvent = (code: number, content: unknown, actorNr: number): void => {
      this.onEvent?.(code, content as EventData, actorNr.toString());
    };

    this.client.onActorJoin = (actor: IPhotonActor): void => {
      console.log(
        `[Photon] Actor Joined: ${actor.actorNr} (${actor.name}) | My ID: ${this.client.myActor().actorNr}`
      );
      if (actor.actorNr !== this.client.myActor().actorNr) {
        this.onPlayerJoined?.({
          userId: actor.actorNr.toString(),
          isMaster: actor.actorNr === this.client.myRoom().masterClientId,
          name: actor.name,
        });
      }
    };

    this.client.onActorLeave = (actor: IPhotonActor): void => {
      console.log(`[Photon] Actor Left: ${actor.actorNr}`);
      this.onPlayerLeft?.(actor.actorNr.toString());
    };

    this.client.onError = (errorCode: number, errorMsg: string): void => {
      console.error(`[Photon] Error ${errorCode}: ${errorMsg}`);
      this.onStateChanged?.(NetworkState.Error);
    };
  }

  private mapState(photonState: number): NetworkState {
    const States = PhotonTyped.LoadBalancing.LoadBalancingClient.State;
    switch (photonState) {
      case States.Joined:
        return NetworkState.InRoom;
      case States.Disconnected:
      case States.Uninitialized:
        return NetworkState.Disconnected;
      case States.Error:
        return NetworkState.Error;
      case States.ConnectingToNameServer:
      case States.ConnectingToMasterserver:
      case States.ConnectingToGameserver:
      case States.ConnectedToNameServer:
      case States.ConnectedToMaster:
      case States.ConnectedToGameserver:
        return NetworkState.Connecting;
      case States.JoinedLobby:
        return NetworkState.InLobby;
      default:
        return NetworkState.Disconnected;
    }
  }

  public async connect(userId: string): Promise<boolean> {
    this.client.setUserId(userId);
    this.client.myActor().setName(userId);
    // NameServer 접속 시도
    return this.client.connectToRegionMaster('kr');
  }

  public disconnect(): void {
    if (this.client.isJoinedToRoom()) {
      this.client.leaveRoom();
    }
    this.client.disconnect();
  }
  public async createRoom(options: {
    roomName?: string;
    mapId: string;
    maxPlayers: number;
    gameMode: string;
  }): Promise<boolean> {
    const roomName = options.roomName || `${this.client.myActor().name}'s Room`;

    const roomOptions = {
      isVisible: true,
      isOpen: true,
      maxPlayers: options.maxPlayers || 4,
      customGameProperties: {
        mapId: options.mapId || 'training_ground',
        gameMode: options.gameMode || 'survival',
      },
      propsListedInLobby: ['mapId', 'gameMode'],
    };

    console.log(`[Photon] Attempting to create room: ${roomName}`, roomOptions);
    if (!this.client.isInLobby()) {
      console.warn('[Photon] createRoom called while NOT in lobby. State:', this.client.state);
    }
    return this.client.createRoom(roomName, roomOptions);
  }

  public async joinRoom(roomId: string): Promise<boolean> {
    return this.client.joinRoom(roomId);
  }

  public getRoomList(): Promise<RoomData[]> {
    // Photon LoadBalancingClient automatically updates availableRooms
    // We can return the current scheduled/cached list or wrap a one-time fetch if needed.
    // However, LoadBalancingClient usually syncs rooms via callbacks.
    // We will return a resolved promise with the current known list.

    const rooms = this.client.availableRooms() || [];
    const roomInfos: RoomData[] = rooms.map((r: IPhotonRoom) => ({
      id: r.name, // Use name as ID
      name: r.name,
      maxPlayers: r.maxPlayers,
      playerCount: r.playerCount,
      customProperties: r.getCustomProperties(),
      isOpen: r.isOpen,
    }));
    return Promise.resolve(roomInfos);
  }

  public leaveRoom(): void {
    this.client.leaveRoom();
  }

  public sendEvent(
    code: number,
    data: EventData,
    reliable: boolean = true,
    target: 'others' | 'all' | 'master' | string = 'others'
  ): void {
    let receiverGroup = PhotonTyped.LoadBalancing.Constants.ReceiverGroup.Others;
    let targetActors: number[] | undefined = undefined;

    if (target === 'all') {
      receiverGroup = PhotonTyped.LoadBalancing.Constants.ReceiverGroup.All;
    } else if (target === 'master') {
      receiverGroup = PhotonTyped.LoadBalancing.Constants.ReceiverGroup.MasterClient;
    } else if (target === 'others') {
      receiverGroup = PhotonTyped.LoadBalancing.Constants.ReceiverGroup.Others;
    } else {
      // It's a specific peer ID (actorNr)
      targetActors = [parseInt(target, 10)];
      receiverGroup = 0; // Not used when targetActors is set
    }

    this.client.raiseEvent(code, data, {
      receivers: receiverGroup,
      targetActors: targetActors,
      cache: reliable ? 1 : 0,
    });
  }

  public getLocalPlayerId(): string | null {
    return this.client.myActor()?.actorNr?.toString() || null;
  }

  public getServerTime(): number {
    // Photon Realtime JS (4.x) 에서 서버 시간은 loadBalancingPeer를 통해 가져옵니다.
    if (
      this.client &&
      this.client.loadBalancingPeer &&
      typeof this.client.loadBalancingPeer.getServerTime === 'function'
    ) {
      return this.client.loadBalancingPeer.getServerTime();
    }

    // 기본값으로 현재 로컬 시간을 반환 (동기화 정밀도는 떨어질 수 있음)
    return Date.now();
  }

  public getCurrentRoomProperty(key: string): unknown {
    if (this.client.isJoinedToRoom()) {
      return this.client.myRoom().getCustomProperty(key);
    }
    return null;
  }

  public isMasterClient(): boolean {
    if (!this.client.isJoinedToRoom()) return false;
    return this.client.myActor().actorNr === this.client.myRoom().masterClientId;
  }

  public getActors(): Map<string, { id: string; name: string }> {
    const actors = new Map<string, { id: string; name: string }>();
    if (this.client.isJoinedToRoom()) {
      const roomActors = this.client.myRoom().actors;
      for (const nr in roomActors) {
        const a: IPhotonActor = roomActors[nr];
        actors.set(nr.toString(), { id: nr.toString(), name: a.name || 'Anonymous' });
      }
    }
    return actors;
  }

  public refreshRoomList(): void {
    this.updateRoomListFromClient();
  }

  private updateRoomListFromClient(): void {
    if (!this.client || typeof this.client.availableRooms !== 'function') return;

    const rooms = this.client.availableRooms() || [];
    console.log('[Photon] Manual room list refresh:', rooms);
    const roomInfos: RoomData[] = rooms.map((r: IPhotonRoom) => ({
      id: r.name,
      name: r.name,
      playerCount: r.playerCount,
      maxPlayers: r.maxPlayers,
      isOpen: r.isOpen,
      customProperties: r.getCustomProperties(),
    }));
    this.onRoomListUpdated?.(roomInfos);
  }
}
