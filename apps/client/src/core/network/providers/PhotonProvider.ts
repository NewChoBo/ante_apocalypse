import { INetworkProvider, CreateRoomOptions } from '../INetworkProvider';
import { RoomInfo, NetworkState, PlayerInfo, Logger } from '@ante/common';
import {
  mapPhotonState,
  mapRoomList,
  IPhotonClient,
  PhotonActor,
  Photon, // Use wrapper from game-core
  LoadBalancing, // Use wrapper from game-core
  ConnectionProtocol, // Use wrapper from game-core
  ReceiverGroup,
} from '@ante/game-core';

const logger = new Logger('PhotonProvider');

/**
 * Photon Realtime Cloud를 이용한 네트워크 프로바이더 구현체.
 */
export class PhotonProvider implements INetworkProvider {
  private client: IPhotonClient;
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
    if (typeof window !== 'undefined' && Photon['PhotonPeer']) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (Photon['PhotonPeer'] as any).setWebSocketImpl(WebSocket);
    }

    if (!this.appId || this.appId === 'YOUR_APP_ID_HERE') {
      logger.error('AppID is missing! Please set VITE_PHOTON_APP_ID in your .env file.');
    }

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

      this.onStateChanged?.(mappedState);

      if (mappedState === NetworkState.InLobby) {
        setTimeout(() => {
          this.updateRoomListFromClient();
        }, 500);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.client.onRoomListUpdate = (rooms: any[]): void => {
      const roomInfos: RoomInfo[] = mapRoomList(rooms);
      this.onRoomListUpdated?.(roomInfos);
    };

    this.client.onEvent = (code: number, content: unknown, actorNr: number): void => {
      this.onEvent?.(code, content, actorNr.toString());
    };

    this.client.onActorJoin = (actor: PhotonActor): void => {
      logger.info(
        `Actor Joined: ${actor.actorNr} (${actor.name}) | My ID: ${this.client.myActor().actorNr}`
      );
      if (actor.actorNr !== this.client.myActor().actorNr) {
        this.onPlayerJoined?.({
          userId: actor.actorNr.toString(),
          isMaster: actor.actorNr === this.client.myRoom().masterClientId,
          name: actor.name || 'Anonymous',
        });
      }
    };

    this.client.onActorLeave = (actor: PhotonActor): void => {
      logger.info(`Actor Left: ${actor.actorNr}`);
      this.onPlayerLeft?.(actor.actorNr.toString());

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

    // myActor() might return actor with minimal methods initially
    // We assume setName exists or handled by setUserId internals usually,
    // but in Photon JS we might need to set it on the actor object if joined?
    // Actually LoadBalancingClient.myActor() returns the local actor.
    this.client.myActor().setName(userId);

    this.client.connectToRegionMaster('kr');
    return true;
  }

  public disconnect(): void {
    this.client.disconnect();
  }

  public async joinRoom(roomId: string): Promise<boolean> {
    if (!this.client.isInLobby() && !this.client.isJoinedToRoom()) {
      logger.warn('Cannot join room: Not in lobby or already in a room.');
      return false;
    }

    if (!this.client.isConnectedToMaster()) {
      logger.error('Cannot join room: Not connected to master/name server.');
      return false;
    }

    try {
      this.client.joinRoom(roomId);
      return true;
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
      this.client.createRoom(name, options);
      return true;
    } catch (e) {
      logger.error('createRoom exception:', e);
      return false;
    }
  }

  public getRoomList(): Promise<RoomInfo[]> {
    const rooms = this.client.availableRooms();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Promise.resolve(mapRoomList(rooms as any[]));
  }

  public leaveRoom(): void {
    this.client.leaveRoom();
  }

  public sendEvent(code: number, data: unknown, reliable: boolean = true): void {
    this.client.raiseEvent(code, data, {
      receivers: ReceiverGroup.Others,
      cache: reliable ? 1 : 0,
    });
  }

  public getLocalPlayerId(): string | null {
    return this.client.myActor()?.actorNr?.toString() || null;
  }

  public getServerTime(): number {
    if (
      this.client &&
      this.client.loadBalancingPeer &&
      typeof this.client.loadBalancingPeer.getServerTime === 'function'
    ) {
      return this.client.loadBalancingPeer.getServerTime();
    }

    return Date.now();
  }

  public getCurrentRoomProperty<T = unknown>(key: string): T | null {
    if (this.client.isJoinedToRoom()) {
      return (this.client.myRoom().getCustomProperty(key) as T) || null;
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
      // roomActors is { [key: number]: PhotonActor }
      for (const nrStr in roomActors) {
        if (Object.prototype.hasOwnProperty.call(roomActors, nrStr)) {
          const nr = parseInt(nrStr);
          const a = roomActors[nr];
          actors.set(nr.toString(), { id: nr.toString(), name: a.name || 'Anonymous' });
        }
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
    if (!this.client) return;

    const rooms = this.client.availableRooms();
    logger.info('Manual room list refresh:', rooms);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.onRoomListUpdated?.(mapRoomList(rooms as any[]));
  }
}
