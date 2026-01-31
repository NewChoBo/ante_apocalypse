import * as Photon from 'photon-realtime';
import { INetworkProvider, CreateRoomOptions } from '../INetworkProvider';
import { RoomInfo, NetworkState, PlayerInfo, Logger } from '@ante/common';
import { mapPhotonState, mapRoomList } from '@ante/game-core';

const logger = new Logger('PhotonProvider');

// Photon 라이브러리 타입 정의 (SDK에서 타입이 제공되지 않음)
type PhotonClient = {
  setUserId(userId: string): void;
  myActor(): { actorNr: number; name: string; setName(name: string): void };
  connectToRegionMaster(region: string): boolean;
  disconnect(): void;
  isInLobby(): boolean;
  isJoinedToRoom(): boolean;
  isConnectedToMaster(): boolean;
  isConnectedToNameServer(): boolean;
  joinRoom(roomId: string): boolean;
  createRoom(name: string, options?: CreateRoomOptions): boolean;
  leaveRoom(): void;
  raiseEvent(code: number, data: unknown, options: object): void;
  availableRooms(): unknown[];
  myRoom(): {
    name?: string;
    masterClientId: number;
    actors: Record<string, { name: string }>;
    getCustomProperty(key: string): unknown;
  };
  loadBalancingPeer?: { getServerTime(): number };
  onStateChange?: (state: number) => void;
  onRoomListUpdate?: (rooms: unknown[]) => void;
  onEvent?: (code: number, content: unknown, actorNr: number) => void;
  onActorJoin?: (actor: { actorNr: number; name: string }) => void;
  onActorLeave?: (actor: { actorNr: number }) => void;
  onError?: (errorCode: number, errorMsg: string) => void;
};

/**
 * Photon Realtime Cloud를 이용한 네트워크 프로바이더 구현체.
 */
export class PhotonProvider implements INetworkProvider {
  private client: PhotonClient;
  private appId: string = import.meta.env.VITE_PHOTON_APP_ID || '';
  private appVersion: string = import.meta.env.VITE_PHOTON_APP_VERSION || '1.0';

  public onStateChanged?: (state: NetworkState) => void;
  public onRoomListUpdated?: (rooms: RoomInfo[]) => void;
  public onEvent?: (code: number, data: unknown, senderId: string) => void;
  public onPlayerJoined?: (user: PlayerInfo) => void;
  public onPlayerLeft?: (userId: string) => void;
  public onMasterClientSwitched?: (newMasterId: string) => void;

  constructor() {
    // browser 환경에서 require('ws') 에러 방지를 위해 WebSocket 구현체 재설정
    const photonAny = Photon as unknown as Record<string, unknown>;
    if (typeof window !== 'undefined' && photonAny['PhotonPeer']) {
      (
        photonAny['PhotonPeer'] as { setWebSocketImpl(impl: typeof WebSocket): void }
      ).setWebSocketImpl(WebSocket);
    }

    if (!this.appId || this.appId === 'YOUR_APP_ID_HERE') {
      logger.error('AppID is missing! Please set VITE_PHOTON_APP_ID in your .env file.');
    }

    const LoadBalancing = photonAny['LoadBalancing'] as {
      LoadBalancingClient: new (protocol: number, appId: string, version: string) => PhotonClient;
    };
    const ConnectionProtocol = photonAny['ConnectionProtocol'] as { Wss: number };

    this.client = new LoadBalancing.LoadBalancingClient(
      ConnectionProtocol.Wss,
      this.appId,
      this.appVersion
    );

    this.setupListeners();
  }

  private setupListeners(): void {
    this.client.onStateChange = (state: number): void => {
      const mappedState = mapPhotonState(state);
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

    this.client.onRoomListUpdate = (rooms: unknown[]): void => {
      const roomInfos: RoomInfo[] = mapRoomList(rooms);
      this.onRoomListUpdated?.(roomInfos);
    };

    this.client.onEvent = (code: number, content: unknown, actorNr: number): void => {
      this.onEvent?.(code, content, actorNr.toString());
    };

    this.client.onActorJoin = (actor: { actorNr: number; name: string }): void => {
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

    this.client.onActorLeave = (actor: { actorNr: number }): void => {
      logger.info(`Actor Left: ${actor.actorNr}`);
      this.onPlayerLeft?.(actor.actorNr.toString());

      // Check if we became the new Master Client
      if (this.isMasterClient()) {
        const myId = this.getLocalPlayerId();
        if (myId) {
          this.onMasterClientSwitched?.(myId);
        }
      }
    };

    this.client.onError = (errorCode: number, errorMsg: string): void => {
      logger.error(`Error ${errorCode}: ${errorMsg}`);
      this.onStateChanged?.(NetworkState.Error);
    };
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

  public async createRoom(name: string, options?: CreateRoomOptions): Promise<boolean> {
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
    const rooms = this.client.availableRooms() || [];
    return Promise.resolve(mapRoomList(rooms));
  }

  public leaveRoom(): void {
    this.client.leaveRoom();
  }

  public sendEvent(code: number, data: unknown, reliable: boolean = true): void {
    const photonAny = Photon as unknown as Record<string, unknown>;
    const Constants = (
      photonAny['LoadBalancing'] as { Constants: { ReceiverGroup: { Others: number } } }
    ).Constants;
    this.client.raiseEvent(code, data, {
      receivers: Constants.ReceiverGroup.Others,
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
        const a = roomActors[nr];
        actors.set(nr.toString(), { id: nr.toString(), name: a.name || 'Anonymous' });
      }
    }
    return actors;
  }

  public getCurrentRoomName(): string | null {
    if (this.client.isJoinedToRoom()) {
      return this.client.myRoom().name ?? null;
    }
    return null;
  }

  public refreshRoomList(): void {
    this.updateRoomListFromClient();
  }

  private updateRoomListFromClient(): void {
    if (!this.client || typeof this.client.availableRooms !== 'function') return;

    const rooms = this.client.availableRooms() || [];
    logger.info('Manual room list refresh:', rooms);
    this.onRoomListUpdated?.(mapRoomList(rooms));
  }
}
