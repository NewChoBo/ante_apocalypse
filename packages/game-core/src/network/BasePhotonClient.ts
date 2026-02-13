import { Logger } from '@ante/common';
import { INetworkAuthority } from './INetworkAuthority.js';
import { NetworkDispatcher } from './NetworkDispatcher.js';
import { LoadBalancing, ConnectionProtocol, ReceiverGroup } from './PhotonWrapper.js';

const logger = new Logger('BasePhotonClient');

/**
 * Photon JS Library Typed Definitions
 */
export type RoomOptions = {
  isVisible?: boolean;
  isOpen?: boolean;
  maxPlayers?: number;
  customGameProperties?: { [key: string]: unknown };
  propsListedInLobby?: string[];
  [key: string]: unknown;
};

export type PhotonActor = import('photon-realtime').LoadBalancing.Actor;
export type PhotonRoom = import('photon-realtime').LoadBalancing.Room;

/**
 * Photon JS Library Interface Definition
 */
export interface IPhotonClient {
  onStateChange: (state: number) => void;
  onEvent: (code: number, content: unknown, actorNr: number) => void;
  onActorJoin: (actor: import('photon-realtime').LoadBalancing.Actor) => void;
  onActorLeave: (actor: import('photon-realtime').LoadBalancing.Actor) => void;
  onRoomListUpdate: (rooms: unknown[]) => void;
  onError: (errorCode: number, errorMsg: string) => void;
  raiseEvent: (
    code: number,
    data: unknown,
    options?: { receivers?: number; cache?: number; targetActors?: number[] }
  ) => void;
  connectToRegionMaster: (region: string) => void;
  disconnect: () => void;
  createRoom: (name: string, options?: RoomOptions) => void;
  joinRoom: (name: string, options?: RoomOptions) => void;
  leaveRoom: () => void;
  isConnectedToMaster: () => boolean;
  isInLobby: () => boolean;
  isJoinedToRoom: () => boolean;
  myActor: () => import('photon-realtime').LoadBalancing.Actor;
  myRoom: () => import('photon-realtime').LoadBalancing.Room;
  loadBalancingPeer: { getServerTime: () => number };
  availableRooms(): unknown[];
  setUserId(userId: string): void;
}

/**
 * Abstract base class for Photon Realtime clients.
 * Shared between Client (PhotonProvider) and Server (ServerNetworkAuthority).
 */
export abstract class BasePhotonClient implements INetworkAuthority {
  protected client: IPhotonClient;
  protected appId: string;
  protected appVersion: string;
  protected dispatcher: NetworkDispatcher = new NetworkDispatcher();
  protected connectionResolver: (() => void) | null = null;

  // Event Callbacks
  public onStateChanged?: (state: number) => void;
  public onActorJoin?: (actorNr: number, name: string) => void;
  public onActorLeave?: (actorNr: number) => void;

  // Callbacks for subclasses
  public onEventReceived?: (code: number, data: unknown, actorNr: number) => void;

  constructor(appId: string, appVersion: string) {
    this.appId = appId;
    this.appVersion = appVersion;

    this.client = new LoadBalancing.LoadBalancingClient(
      ConnectionProtocol.Wss,
      this.appId,
      this.appVersion
    );

    this.setupBaseListeners();
  }

  protected setupBaseListeners(): void {
    this.client.onError = (errorCode: number, errorMsg: string): void => {
      logger.error(`Photon Error ${errorCode}: ${errorMsg}`);
    };

    this.client.onStateChange = (state: number): void => {
      // logger.info(`State: ${state}`);
      if (this.onStateChanged) this.onStateChanged(state);

      const States = LoadBalancing.LoadBalancingClient.State;
      if (state === States.JoinedLobby || state === States.ConnectedToMaster) {
        if (this.connectionResolver) {
          logger.info('Connected & Ready.');
          this.connectionResolver();
          this.connectionResolver = null;
        }
      }
    };

    this.client.onActorJoin = (actor: PhotonActor): void => {
      // logger.info(`Actor Joined: ${actor.actorNr} (${actor.name})`);
      if (this.onActorJoin) this.onActorJoin(actor.actorNr, actor.name);
    };

    this.client.onActorLeave = (actor: PhotonActor): void => {
      // logger.info(`Actor Left: ${actor.actorNr}`);
      if (this.onActorLeave) this.onActorLeave(actor.actorNr);
    };

    this.client.onRoomListUpdate = (_rooms: unknown[]): void => {
      // no-op by default
    };

    this.client.onEvent = (code: number, content: unknown, actorNr: number): void => {
      this.onEventReceived?.(code, content, actorNr);
      this.dispatcher.dispatch(code, content, actorNr.toString());
    };
  }

  public abstract getSocketId(): string | undefined;

  // INetworkAuthority implementations
  public abstract isMasterClient(): boolean;

  public connect(region: string = 'kr'): Promise<void> {
    logger.info('Connecting to Photon...');
    this.client.connectToRegionMaster(region);

    return new Promise((resolve) => {
      this.connectionResolver = resolve;
    });
  }

  public disconnect(): void {
    this.client.disconnect();
  }

  public isConnectedToMaster(): boolean {
    return this.client.isConnectedToMaster();
  }

  public isInLobby(): boolean {
    return this.client.isInLobby();
  }

  public isJoinedToRoom(): boolean {
    return this.client.isJoinedToRoom();
  }

  // Common sending methods
  public sendEventToAll(code: number, data: unknown, reliable: boolean = true): void {
    this.client.raiseEvent(code, data, {
      receivers: ReceiverGroup.All,
      cache: reliable ? 1 : 0,
    });
  }

  public sendRequest(code: number, data: unknown, reliable: boolean = true): void {
    this.sendEvent(code, data, reliable);
  }

  public abstract sendEvent(code: number, data: unknown, reliable?: boolean): void;

  public sendEventToActor(
    code: number,
    data: unknown,
    targetActorNr: number,
    reliable: boolean = true
  ): void {
    this.client.raiseEvent(code, data, {
      targetActors: [targetActorNr],
      cache: reliable ? 1 : 0,
    });
  }

  public getRoomActors(): Map<number, { name: string }> {
    const actors = new Map<number, { name: string }>();
    if (this.client.isJoinedToRoom()) {
      const roomActors = this.client.myRoom().actors;
      for (const key in roomActors) {
        if (Object.prototype.hasOwnProperty.call(roomActors, key)) {
          const nr = parseInt(key);
          const actor = roomActors[nr];
          actors.set(nr, { name: actor.name });
        }
      }
    }
    return actors;
  }

  public getRoomName(): string | null {
    if (this.client.isJoinedToRoom()) {
      return this.client.myRoom().name;
    }
    return null;
  }

  public getCurrentRoomProperty<T = unknown>(key: string): T | undefined {
    if (this.client.isJoinedToRoom()) {
      return this.client.myRoom().getCustomProperty(key) as T;
    }
    return undefined;
  }

  public async createRoom(name: string, mapIdOrOptions: string | RoomOptions): Promise<void> {
    if (!this.client.isConnectedToMaster() && !this.client.isInLobby()) {
      throw new Error('Cannot create room: Not connected.');
    }
    const options: RoomOptions =
      typeof mapIdOrOptions === 'string'
        ? {
            customGameProperties: { mapId: mapIdOrOptions },
            propsListedInLobby: ['mapId'],
          }
        : mapIdOrOptions;
    logger.info(`Creating Room: ${name}`);
    this.client.createRoom(name, options);
  }

  public async joinRoom(name: string): Promise<void> {
    if (!this.client.isConnectedToMaster() && !this.client.isInLobby()) {
      throw new Error('Cannot join room: Not connected.');
    }
    logger.info(`Joining Room: ${name}`);
    this.client.joinRoom(name);
  }

  public leaveRoom(): void {
    this.client.leaveRoom();
  }

  public getServerTime(): number {
    if (this.client?.loadBalancingPeer?.getServerTime) {
      return this.client.loadBalancingPeer.getServerTime();
    }
    return Date.now();
  }

  public getMyActorNr(): number | undefined {
    return this.client.myActor()?.actorNr;
  }

  public getMasterClientId(): number | undefined {
    if (this.isJoinedToRoom()) {
      return this.client.myRoom().masterClientId;
    }
    return undefined;
  }

  protected getDispatcher(): NetworkDispatcher {
    return this.dispatcher;
  }
}
