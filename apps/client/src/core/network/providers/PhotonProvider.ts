import * as Photon from 'photon-realtime';
import { INetworkProvider } from '../INetworkProvider';
import { RoomInfo, NetworkState, PlayerInfo, Logger } from '@ante/common';

const logger = new Logger('PhotonProvider');

/**
 * Photon Realtime Cloud를 이용한 네트워크 프로바이더 구현체.
 */
export class PhotonProvider implements INetworkProvider {
  private client: any;
  private appId: string = import.meta.env.VITE_PHOTON_APP_ID || '';
  private appVersion: string = import.meta.env.VITE_PHOTON_APP_VERSION || '1.0';

  public onStateChanged?: (state: NetworkState) => void;
  public onRoomListUpdated?: (rooms: RoomInfo[]) => void;
  public onEvent?: (code: number, data: any, senderId: string) => void;
  public onPlayerJoined?: (user: PlayerInfo) => void;
  public onPlayerLeft?: (userId: string) => void;

  constructor() {
    // browser 환경에서 require('ws') 에러 방지를 위해 WebSocket 구현체 재설정
    if (typeof window !== 'undefined' && (Photon as any).PhotonPeer) {
      (Photon as any).PhotonPeer.setWebSocketImpl(WebSocket);
    }

    if (!this.appId || this.appId === 'YOUR_APP_ID_HERE') {
      logger.error('AppID is missing! Please set VITE_PHOTON_APP_ID in your .env file.');
    }

    this.client = new (Photon as any).LoadBalancing.LoadBalancingClient(
      (Photon as any).ConnectionProtocol.Wss,
      this.appId,
      this.appVersion
    );

    this.setupListeners();
  }

  private setupListeners(): void {
    this.client.onStateChange = (state: number) => {
      const mappedState = this.mapState(state);
      logger.info(`State changed: ${mappedState}`);

      // Auto-join lobby when connected to master
      this.onStateChanged?.(mappedState);

      if (mappedState === NetworkState.InLobby) {
        // Initial fetch with slight delay to ensure list is populated
        setTimeout(() => {
          this.updateRoomListFromClient();
        }, 500);
      }
    };

    this.client.onRoomListUpdate = (rooms: any[]) => {
      const roomInfos: RoomInfo[] = rooms.map((r) => ({
        id: r.name,
        name: r.name,
        playerCount: r.playerCount,
        maxPlayers: r.maxPlayers,
        isOpen: r.isOpen,
        customProperties: r.getCustomProperties(),
      }));
      this.onRoomListUpdated?.(roomInfos);
    };

    this.client.onEvent = (code: number, content: any, actorNr: number) => {
      this.onEvent?.(code, content, actorNr.toString());
    };

    this.client.onActorJoin = (actor: any) => {
      logger.info(
        `Actor Joined: ${actor.actorNr} (${actor.name}) | My ID: ${this.client.myActor().actorNr}`
      );
      if (actor.actorNr !== this.client.myActor().actorNr) {
        this.onPlayerJoined?.({
          userId: actor.actorNr.toString(),
          isMaster: actor.actorNr === this.client.myRoom().masterClientId,
          name: actor.name,
        });
      }
    };

    this.client.onActorLeave = (actor: any) => {
      logger.info(`Actor Left: ${actor.actorNr}`);
      this.onPlayerLeft?.(actor.actorNr.toString());
    };

    this.client.onError = (errorCode: number, errorMsg: string) => {
      logger.error(`Error ${errorCode}: ${errorMsg}`);
      this.onStateChanged?.(NetworkState.Error);
    };
  }

  private mapState(photonState: number): NetworkState {
    const States = (Photon as any).LoadBalancing.LoadBalancingClient.State;
    switch (photonState) {
      case States.Uninitialized:
      case States.Disconnected:
        return NetworkState.Disconnected;
      case States.ConnectingToNameServer:
      case States.ConnectingToMasterserver:
      case States.ConnectingToGameserver:
        return NetworkState.Connecting;
      case States.ConnectedToNameServer:
      case States.ConnectedToMaster:
        return NetworkState.ConnectedToMaster;
      case States.JoinedLobby:
        return NetworkState.InLobby;
      case States.Joined:
        return NetworkState.InRoom;
      case States.Error:
        return NetworkState.Error;
      default:
        // Other intermediate states like LeavingRoom, etc.
        return NetworkState.Connecting;
    }
  }

  public async connect(userId: string): Promise<boolean> {
    this.client.setUserId(userId);
    this.client.myActor().setName(userId);

    // NameServer 접속 시도
    return this.client.connectToRegionMaster('kr');
  }

  public disconnect(): void {
    this.client.disconnect();
  }

  public async joinRoom(roomId: string): Promise<boolean> {
    if (!this.client.isInLobby() && !this.client.isJoinedToRoom()) {
      logger.warn('Cannot join room: Not in lobby or already in a room.');
      return false;
    }

    if (!this.client.isConnectedToMaster() && !this.client.isConnectedToNameServer()) {
      logger.error('Cannot join room: Not connected to master/name server.');
      return false;
    }

    try {
      return this.client.joinRoom(roomId);
    } catch (e) {
      logger.error('joinRoom exception:', e);
      return false;
    }
  }

  public async createRoom(name: string, options?: any): Promise<boolean> {
    if (!this.client.isConnectedToMaster()) {
      logger.error('Cannot create room: Not connected to Master Server.');
      return false;
    }
    try {
      return this.client.createRoom(name, options);
    } catch (e) {
      logger.error('createRoom exception:', e);
      return false;
    }
  }

  public getRoomList(): Promise<RoomInfo[]> {
    // Photon LoadBalancingClient automatically updates availableRooms
    // We can return the current scheduled/cached list or wrap a one-time fetch if needed.
    // However, LoadBalancingClient usually syncs rooms via callbacks.
    // We will return a resolved promise with the current known list.
    const rooms = this.client.availableRooms() || [];
    const roomInfos: RoomInfo[] = rooms.map((r: any) => ({
      id: r.name, // Use name as ID
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

  public sendEvent(code: number, data: any, reliable: boolean = true): void {
    this.client.raiseEvent(code, data, {
      receivers: (Photon as any).LoadBalancing.Constants.ReceiverGroup.Others,
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

  public getCurrentRoomProperty(key: string): any {
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
        const a = roomActors[nr];
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
    logger.info('Manual room list refresh:', rooms);
    const roomInfos: RoomInfo[] = rooms.map((r: any) => ({
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
