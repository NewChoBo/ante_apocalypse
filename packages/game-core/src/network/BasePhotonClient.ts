// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import Photon from 'photon-realtime';
import { Logger } from '@ante/common';
import { INetworkAuthority } from './INetworkAuthority.js';
import { NetworkDispatcher } from './NetworkDispatcher.js';

const logger = new Logger('BasePhotonClient');

/**
 * Abstract base class for Photon Realtime clients.
 * Shared between Client (PhotonProvider) and Server (ServerNetworkAuthority).
 */
export abstract class BasePhotonClient implements INetworkAuthority {
  protected client: any; // Photon.LoadBalancing.LoadBalancingClient
  protected dispatcher: NetworkDispatcher = new NetworkDispatcher();
  protected connectionResolver: (() => void) | null = null;

  // Callbacks for subclasses to implement/override
  public onActorJoin?: (actorNr: number, name: string) => void;
  public onActorLeave?: (actorNr: number) => void;
  public onEventReceived?: (code: number, data: unknown, actorNr: number) => void;
  public onStateChanged?: (state: number) => void;

  constructor(
    protected appId: string,
    protected appVersion: string
  ) {
    this.client = new (Photon as any).LoadBalancing.LoadBalancingClient(
      (Photon as any).ConnectionProtocol.Wss,
      this.appId,
      this.appVersion
    );

    this.setupBaseListeners();
  }

  private setupBaseListeners(): void {
    this.client.onStateChange = (state: number) => {
      logger.info(`State Changed: ${state}`);
      this.onStateChanged?.(state);

      const States = (Photon as any).LoadBalancing.LoadBalancingClient.State;
      if (state === States.JoinedLobby || state === States.ConnectedToMaster) {
        if (this.connectionResolver) {
          logger.info('Connected & Ready.');
          this.connectionResolver();
          this.connectionResolver = null;
        }
      }
    };

    this.client.onEvent = (code: number, content: unknown, actorNr: number) => {
      this.onEventReceived?.(code, content, actorNr);
      this.dispatcher.dispatch(code, content, actorNr.toString());
    };

    this.client.onActorJoin = (actor: any) => {
      const myActorNr = this.client.myActor()?.actorNr;
      if (actor.actorNr !== myActorNr) {
        this.onActorJoin?.(actor.actorNr, actor.name || 'Anonymous');
      }
    };

    this.client.onActorLeave = (actor: any) => {
      this.onActorLeave?.(actor.actorNr);
    };

    this.client.onError = (errorCode: number, errorMsg: string) => {
      logger.error(`Photon Error ${errorCode}: ${errorMsg}`);
    };
  }

  // INetworkAuthority implementation
  public abstract isMasterClient(): boolean;

  public getSocketId(): string | undefined {
    return this.client.myActor()?.actorNr?.toString();
  }

  public sendEvent(code: number, data: unknown, reliable: boolean = true): void {
    this.client.raiseEvent(code, data, {
      receivers: (Photon as any).LoadBalancing.Constants.ReceiverGroup.Others,
      cache: reliable ? 1 : 0,
    });
  }

  public sendEventToAll(code: number, data: unknown): void {
    this.client.raiseEvent(code, data, {
      receivers: (Photon as any).LoadBalancing.Constants.ReceiverGroup.All,
    });
  }

  public sendEventToActor(code: number, data: unknown, targetActorNr: number): void {
    this.client.raiseEvent(code, data, {
      targetActors: [targetActorNr],
    });
  }

  // Connection lifecycle
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

  // Room management
  public async createRoom(name: string, options?: any): Promise<void> {
    if (!this.client.isConnectedToMaster() && !this.client.isInLobby()) {
      throw new Error('Cannot create room: Not connected.');
    }
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

  // State queries
  public getServerTime(): number {
    if (this.client?.loadBalancingPeer?.getServerTime) {
      return this.client.loadBalancingPeer.getServerTime();
    }
    return Date.now();
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

  public getMyActorNr(): number | undefined {
    return this.client.myActor()?.actorNr;
  }

  public getRoomActors(): Map<number, { name: string }> {
    const actors = new Map<number, { name: string }>();
    if (this.isJoinedToRoom()) {
      const roomActors = this.client.myRoom().actors;
      for (const nr in roomActors) {
        actors.set(parseInt(nr), { name: roomActors[nr].name || 'Anonymous' });
      }
    }
    return actors;
  }

  public getMasterClientId(): number | undefined {
    if (this.isJoinedToRoom()) {
      return this.client.myRoom().masterClientId;
    }
    return undefined;
  }

  public getCurrentRoomProperty(key: string): any {
    if (this.isJoinedToRoom()) {
      return this.client.myRoom().getCustomProperty(key);
    }
    return null;
  }

  public getRoomName(): string | undefined {
    if (this.isJoinedToRoom()) {
      return this.client.myRoom().name;
    }
    return undefined;
  }

  // Dispatcher access for subclasses
  protected getDispatcher(): NetworkDispatcher {
    return this.dispatcher;
  }
}
