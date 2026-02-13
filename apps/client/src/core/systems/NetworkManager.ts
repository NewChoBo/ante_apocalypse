import { Observable, Vector3 } from '@babylonjs/core';
import { INetworkProvider } from '../network/INetworkProvider';
import {
  INetworkAuthority,
  LogicalServer,
} from '@ante/game-core';
import { LocalServerManager } from '../server/LocalServerManager';
import {
  RoomInfo,
  NetworkState,
  EventCode,
  PlayerState,
  FireEventData,
  HitEventData,
  DeathEventData,
  RequestHitData,
  EnemyMovePayload,
  EnemyHitPayload,
  InitialStatePayload,
  TargetHitPayload,
  TargetDestroyPayload,
  SpawnTargetPayload,
  EnemyDestroyPayload,
  PickupDestroyPayload,
  RespawnEventData,
  GameEndEventData,
  Logger,
} from '@ante/common';
import { ConnectionManager } from '../network/ConnectionManager';
import { PlayerStateManager } from '../network/PlayerStateManager';
import { RoomManager } from '../network/RoomManager';
import { INetworkManager } from '../interfaces/INetworkManager';
import { NetworkEventRouter } from '../network/services/NetworkEventRouter';
import { NetworkSessionService } from '../network/services/NetworkSessionService';
import { NetworkLifecycleService } from '../network/services/NetworkLifecycleService';
import { AuthorityDispatchService } from '../network/services/AuthorityDispatchService';
import { NetworkProviderEvent } from '../network/INetworkProvider';

const logger = new Logger('NetworkManager');

/**
 * Network facade.
 * Session management / event routing / lifecycle are delegated to dedicated services.
 */
export class NetworkManager implements INetworkAuthority, INetworkManager {
  public static readonly AUTHORITY_LOOPBACK_SENDER_ID = '__authority__';

  private provider: INetworkProvider;
  private localServerManager: LocalServerManager;
  private localServer: LogicalServer | null = null;

  private connectionManager: ConnectionManager;
  private playerStateManager: PlayerStateManager;
  private roomManager: RoomManager;
  private eventRouter: NetworkEventRouter;
  private sessionService: NetworkSessionService;
  private lifecycleService: NetworkLifecycleService;
  private authorityDispatchService: AuthorityDispatchService;
  private providerUnsubscribe: () => void = () => undefined;

  public get onPlayerJoined(): Observable<PlayerState> {
    return this.playerStateManager.onPlayerJoined;
  }

  public get onPlayerUpdated(): Observable<PlayerState> {
    return this.playerStateManager.onPlayerUpdated;
  }

  public get onPlayerLeft(): Observable<string> {
    return this.playerStateManager.onPlayerLeft;
  }

  public get onStateChanged(): Observable<NetworkState> {
    return this.connectionManager.onStateChanged;
  }

  public get currentState(): NetworkState {
    return this.connectionManager.currentState;
  }

  public get onRoomListUpdated(): Observable<RoomInfo[]> {
    return this.roomManager.onRoomListUpdated;
  }

  public get onPlayersList(): Observable<PlayerState[]> {
    return this.eventRouter.onPlayersList;
  }

  public get onPlayerFired(): Observable<FireEventData> {
    return this.eventRouter.onPlayerFired;
  }

  public get onPlayerReloaded(): Observable<{ playerId: string; weaponId: string }> {
    return this.eventRouter.onPlayerReloaded;
  }

  public get onPlayerHit(): Observable<HitEventData> {
    return this.eventRouter.onPlayerHit;
  }

  public get onPlayerDied(): Observable<DeathEventData> {
    return this.eventRouter.onPlayerDied;
  }

  public get onPlayerRespawn(): Observable<RespawnEventData> {
    return this.eventRouter.onPlayerRespawn;
  }

  public get onGameEnd(): Observable<GameEndEventData> {
    return this.eventRouter.onGameEnd;
  }

  public get onEnemyUpdated(): Observable<EnemyMovePayload> {
    return this.eventRouter.onEnemyUpdated;
  }

  public get onEnemyHit(): Observable<EnemyHitPayload> {
    return this.eventRouter.onEnemyHit;
  }

  public get onEnemyDestroyed(): Observable<EnemyDestroyPayload> {
    return this.eventRouter.onEnemyDestroyed;
  }

  public get onPickupDestroyed(): Observable<PickupDestroyPayload> {
    return this.eventRouter.onPickupDestroyed;
  }

  public get onInitialStateRequested(): Observable<{ senderId: string }> {
    return this.eventRouter.onInitialStateRequested;
  }

  public get onInitialStateReceived(): Observable<InitialStatePayload> {
    return this.eventRouter.onInitialStateReceived;
  }

  public get onEvent(): Observable<{ code: number; data: unknown; senderId: string }> {
    return this.eventRouter.onEvent;
  }

  public get onTargetHit(): Observable<TargetHitPayload> {
    return this.eventRouter.onTargetHit;
  }

  public get onTargetDestroy(): Observable<TargetDestroyPayload> {
    return this.eventRouter.onTargetDestroy;
  }

  public get onTargetSpawn(): Observable<SpawnTargetPayload> {
    return this.eventRouter.onTargetSpawn;
  }

  constructor(localServerManager: LocalServerManager, provider: INetworkProvider) {
    this.provider = provider;
    this.localServerManager = localServerManager;
    this.connectionManager = new ConnectionManager(this.provider);
    this.playerStateManager = new PlayerStateManager();
    this.roomManager = new RoomManager(this.provider, () => this.connectionManager.currentState);
    this.eventRouter = new NetworkEventRouter(this.playerStateManager, () => this.getSocketId());

    this.sessionService = new NetworkSessionService({
      roomManager: this.roomManager,
      setLocalServer: (server): void => this.setLocalServer(server),
      isMasterClient: (): boolean => this.isMasterClient(),
      requestInitialState: (): void => this.sendRequest(EventCode.REQ_INITIAL_STATE, {}, true),
      clearSessionObservers: (): void => this.clearObservers('session'),
      isLocalServerRunning: (): boolean => this.localServerManager.isServerRunning(),
      startLocalSession: (roomName, mapId, gameMode): Promise<void> =>
        this.localServerManager.startSession(this, roomName, mapId, gameMode),
      takeoverLocalSession: (roomName): Promise<void> =>
        this.localServerManager.takeover(this, roomName),
      stopLocalSession: (): void => {
        this.localServerManager.stopSession();
        this.setLocalServer(null);
      },
      getLogicalServer: (): LogicalServer | null => this.localServerManager.getLogicalServer(),
    });

    this.lifecycleService = new NetworkLifecycleService({
      unsubscribeProvider: (): void => {
        this.providerUnsubscribe();
        this.providerUnsubscribe = (): void => undefined;
      },
      clearEventObservers: (scope): void => this.eventRouter.clearObservers(scope),
      clearPlayerStateObservers: (): void => this.playerStateManager.clearObservers(),
      clearStateObservers: (): void => this.connectionManager.onStateChanged.clear(),
      clearRoomObservers: (): void => this.roomManager.onRoomListUpdated.clear(),
      stopLocalServer: (): void => {
        if (this.localServer || this.localServerManager.isServerRunning()) {
          this.localServerManager.stopSession();
          this.setLocalServer(null);
        }
      },
      disposeConnectionManager: (): void => this.connectionManager.dispose(),
      disposeRoomManager: (): void => this.roomManager.dispose(),
      disposePlayerStateManager: (): void => this.playerStateManager.dispose(),
      disconnectProvider: (): void => this.provider.disconnect(),
    });

    this.authorityDispatchService = new AuthorityDispatchService({
      provider: this.provider,
      isMasterClient: (): boolean => this.isMasterClient(),
      getSocketId: (): string | undefined => this.getSocketId(),
      dispatchLocalEvent: (code, data, senderId): void => this.dispatchLocalEvent(code, data, senderId),
      authorityLoopbackSenderId: NetworkManager.AUTHORITY_LOOPBACK_SENDER_ID,
    });

    this.providerUnsubscribe = this.provider.subscribe((event) => this.handleProviderEvent(event));
  }

  public clearObservers(scope: 'session' | 'all' = 'session'): void {
    this.lifecycleService.clearObservers(scope);
  }

  public setLocalServer(server: LogicalServer | null): void {
    this.localServer = server;
    logger.info(`LocalServer ${server ? 'registered' : 'unregistered'} in NetworkManager`);
  }

  private handleProviderEvent(event: NetworkProviderEvent): void {
    switch (event.type) {
      case 'stateChanged':
        this.connectionManager.handleStateChange(event.state);
        return;
      case 'roomListUpdated':
        this.roomManager.handleRoomListUpdate(event.rooms);
        return;
      case 'playerJoined':
        this.eventRouter.handlePlayerJoined(event.user);
        return;
      case 'playerLeft':
        this.eventRouter.handlePlayerLeft(event.userId);
        return;
      case 'transport':
        this.eventRouter.handleTransportEvent(event.event, this.isMasterClient());
        return;
      case 'masterClientSwitched': {
        const myId = this.getSocketId();
        if (myId !== event.newMasterId) return;
        const roomName = this.provider.getCurrentRoomName?.() || null;
        void this.sessionService.handleTakeover(roomName);
      }
    }
  }

  public dispatchLocalEvent(
    code: number,
    data: unknown,
    senderId: string = NetworkManager.AUTHORITY_LOOPBACK_SENDER_ID
  ): void {
    this.eventRouter.dispatchLocalEvent(code, data, senderId);
  }

  public async hostGame(
    roomName: string,
    mapId: string,
    gameMode: string = 'deathmatch'
  ): Promise<boolean> {
    return this.sessionService.hostGame(roomName, mapId, gameMode);
  }

  public async joinGame(roomName: string): Promise<boolean> {
    return this.sessionService.joinGame(roomName);
  }

  public leaveGame(): void {
    this.sessionService.leaveGame();
  }

  public async connect(userId: string): Promise<boolean> {
    return this.connectionManager.connect(userId);
  }

  public async joinRoom(name: string): Promise<boolean> {
    return this.roomManager.joinRoom(name);
  }

  public async createRoom(name: string, mapId: string): Promise<boolean> {
    return this.roomManager.createRoom(name, mapId);
  }

  public leaveRoom(): void {
    this.roomManager.leaveRoom();
    this.clearObservers('session');
  }

  public isMasterClient(): boolean {
    return this.roomManager.isMasterClient();
  }

  public getActors(): Map<string, { id: string; name: string }> {
    return this.roomManager.getActors();
  }

  public getMapId(): string | null {
    return this.roomManager.getMapId();
  }

  public refreshRoomList(): void {
    this.roomManager.refreshRoomList();
  }

  public getRoomList(): RoomInfo[] {
    return this.roomManager.getRoomList();
  }

  public join(data: { position: Vector3; rotation: Vector3; weaponId: string; name: string }): void {
    const myId = this.getSocketId();
    if (myId) {
      this.playerStateManager.registerPlayer({
        id: myId,
        name: data.name,
        position: { x: data.position.x, y: data.position.y, z: data.position.z },
        rotation: { x: data.rotation.x, y: data.rotation.y, z: data.rotation.z },
        weaponId: data.weaponId,
        health: 100,
      });
      this.eventRouter.notifyPlayersSnapshot();
    }
    this.updateState(data);
  }

  public updateState(data: { position: Vector3; rotation: Vector3; weaponId: string }): void {
    const myId = this.getSocketId();
    if (!myId) return;

    const payload = this.playerStateManager.createMovePayload(myId, data.position, data.rotation);
    this.sendRequest(EventCode.MOVE, payload, false);
  }

  public getAllPlayerStates(): PlayerState[] {
    return this.playerStateManager.getAllPlayers();
  }

  public fire(fireData: {
    weaponId: string;
    muzzleTransform?: {
      position: { x: number; y: number; z: number };
      direction: { x: number; y: number; z: number };
    };
  }): void {
    this.sendRequest(EventCode.FIRE, fireData, true);
  }

  public reload(weaponId: string): void {
    const myId = this.getSocketId();
    if (!myId) return;
    this.sendRequest(EventCode.RELOAD, { playerId: myId, weaponId }, true);
  }

  public syncWeapon(weaponId: string): void {
    this.sendRequest(EventCode.SYNC_WEAPON, { weaponId }, true);
  }

  public requestHit(hitData: RequestHitData): void {
    this.sendRequest(EventCode.REQUEST_HIT, hitData, true);
  }

  public sendRequest(code: number, data: unknown, reliable: boolean = true): void {
    this.authorityDispatchService.sendRequest(code, data, reliable);
  }

  public broadcastAuthorityEvent(code: number, data: unknown, reliable: boolean = true): void {
    this.authorityDispatchService.broadcastAuthorityEvent(code, data, reliable);
  }

  public sendEvent(code: number, data: unknown, reliable: boolean = true): void {
    this.authorityDispatchService.sendEvent(code, data, reliable);
  }

  public getSocketId(): string | undefined {
    return this.provider.getLocalPlayerId() || undefined;
  }

  public getServerTime(): number {
    return this.provider.getServerTime();
  }

  public getCurrentRoomProperty<T = unknown>(key: string): T | undefined {
    const value = this.provider.getCurrentRoomProperty(key) as T | null;
    return value ?? undefined;
  }

  public dispose(): void {
    this.lifecycleService.dispose();
  }
}
