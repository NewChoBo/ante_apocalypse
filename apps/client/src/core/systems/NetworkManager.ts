import { Observable, Vector3 } from '@babylonjs/core';
import { INetworkProvider } from '../network/INetworkProvider';
import { PhotonProvider } from '../network/providers/PhotonProvider';
import { INetworkAuthority, NetworkDispatcher, LogicalServer } from '@ante/game-core';
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

const logger = new Logger('NetworkManager');

/**
 * 네트워크 관리 Facade 클래스
 * 기존 API를 유지하면서 내부적으로 분리된 Manager들에 위임
 */
export class NetworkManager implements INetworkAuthority, INetworkManager {
  public static readonly AUTHORITY_LOOPBACK_SENDER_ID = '__authority__';

  private provider: INetworkProvider;
  private localServerManager: LocalServerManager;

  // Sub-managers
  private connectionManager: ConnectionManager;
  private playerStateManager: PlayerStateManager;
  private roomManager: RoomManager;
  private dispatcher: NetworkDispatcher = new NetworkDispatcher();

  // Player Observables (delegated from PlayerStateManager)
  public get onPlayerJoined(): Observable<PlayerState> {
    return this.playerStateManager.onPlayerJoined;
  }
  public get onPlayerUpdated(): Observable<PlayerState> {
    return this.playerStateManager.onPlayerUpdated;
  }
  public get onPlayerLeft(): Observable<string> {
    return this.playerStateManager.onPlayerLeft;
  }

  // Connection Observables (delegated from ConnectionManager)
  public get onStateChanged(): Observable<NetworkState> {
    return this.connectionManager.onStateChanged;
  }
  public get currentState(): NetworkState {
    return this.connectionManager.currentState;
  }

  // Room Observables (delegated from RoomManager)
  public get onRoomListUpdated(): Observable<RoomInfo[]> {
    return this.roomManager.onRoomListUpdated;
  }

  // Game Events (kept in NetworkManager for now)
  public onPlayersList = new Observable<PlayerState[]>();
  public onPlayerFired = new Observable<FireEventData>();
  public onPlayerReloaded = new Observable<{ playerId: string; weaponId: string }>();
  public onPlayerHit = new Observable<HitEventData>();
  public onPlayerDied = new Observable<DeathEventData>();
  public onPlayerRespawn = new Observable<RespawnEventData>();
  public onGameEnd = new Observable<GameEndEventData>();

  // Enemy Synchronization
  public onEnemyUpdated = new Observable<EnemyMovePayload>();
  public onEnemyHit = new Observable<EnemyHitPayload>();
  public onEnemyDestroyed = new Observable<EnemyDestroyPayload>();
  public onPickupDestroyed = new Observable<PickupDestroyPayload>();

  // State Synchronization
  public onInitialStateRequested = new Observable<{ senderId: string }>();
  public onInitialStateReceived = new Observable<InitialStatePayload>();

  // Raw Event Observable
  public onEvent = new Observable<{ code: number; data: unknown; senderId: string }>();

  // Target Observables
  public onTargetHit = new Observable<TargetHitPayload>();
  public onTargetDestroy = new Observable<TargetDestroyPayload>();
  public onTargetSpawn = new Observable<SpawnTargetPayload>();

  constructor(localServerManager: LocalServerManager, provider?: INetworkProvider) {
    this.provider = provider ?? new PhotonProvider();
    this.localServerManager = localServerManager;

    // Initialize sub-managers
    this.connectionManager = new ConnectionManager(this.provider);
    this.playerStateManager = new PlayerStateManager();
    this.roomManager = new RoomManager(this.provider, () => this.connectionManager.currentState);

    this.setupDispatcher();
    this.setupProviderListeners();
  }

  public clearObservers(scope: 'session' | 'all' = 'session'): void {
    this.onPlayersList.clear();
    this.onPlayerFired.clear();
    this.onPlayerReloaded.clear();
    this.onPlayerHit.clear();
    this.onPlayerDied.clear();
    this.onEnemyUpdated.clear();
    this.onEnemyHit.clear();
    this.onEnemyDestroyed.clear();
    this.onPickupDestroyed.clear();
    this.onPlayerRespawn.clear();
    this.onGameEnd.clear();
    this.onInitialStateReceived.clear();
    this.onInitialStateRequested.clear();
    this.onTargetHit.clear();
    this.onTargetDestroy.clear();
    this.onTargetSpawn.clear();
    this.playerStateManager.clearObservers();
    this.onEvent.clear();

    if (scope === 'all') {
      this.connectionManager.onStateChanged.clear();
      this.roomManager.onRoomListUpdated.clear();
      this.dispatcher.clear();
    }
  }

  public setLocalServer(server: LogicalServer | null): void {
    logger.info(`LocalServer ${server ? 'registered' : 'unregistered'} in NetworkManager`);
  }

  private dispatchRawEvent(code: number, data: unknown, senderId: string): void {
    this.dispatcher.dispatch(code as EventCode, data as never, senderId);
  }

  private isServerRequestEvent(code: number): boolean {
    switch (code) {
      case EventCode.MOVE:
      case EventCode.FIRE:
      case EventCode.SYNC_WEAPON:
      case EventCode.RELOAD:
      case EventCode.REQUEST_HIT:
      case EventCode.REQ_INITIAL_STATE:
        return true;
      default:
        return false;
    }
  }

  private sendRequestToMaster(code: number, data: unknown, reliable: boolean = true): void {
    if (this.isMasterClient()) {
      const myId = this.getSocketId();
      if (myId) {
        this.onEvent.notifyObservers({ code, data, senderId: myId });
      }
      return;
    }

    this.provider.sendEventToMaster(code, data, reliable);
  }

  public broadcastAuthorityEvent(code: number, data: unknown, reliable: boolean = true): void {
    this.provider.sendEvent(code, data, reliable);

    // Host must also consume authoritative events locally.
    if (this.isMasterClient()) {
      this.onEvent.notifyObservers({
        code,
        data,
        senderId: NetworkManager.AUTHORITY_LOOPBACK_SENDER_ID,
      });
    }
  }

  private setupDispatcher(): void {
    this.dispatcher.register(EventCode.FIRE, (fireData, senderId): void => {
      const payload = fireData as Partial<FireEventData>;
      const playerId = typeof payload.playerId === 'string' ? payload.playerId : senderId;
      const weaponId = typeof payload.weaponId === 'string' ? payload.weaponId : 'Unknown';

      this.onPlayerFired.notifyObservers({
        playerId,
        weaponId,
        muzzleTransform: payload.muzzleTransform,
      });
    });

    this.dispatcher.register(EventCode.HIT, (data): void => {
      this.onPlayerHit.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.DESTROY_ENEMY, (data): void => {
      this.onEnemyDestroyed.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.DESTROY_PICKUP, (data): void => {
      this.onPickupDestroyed.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.SYNC_WEAPON, (syncData, senderId): void => {
      this.playerStateManager.updatePlayer(senderId, { weaponId: syncData.weaponId });
    });

    this.dispatcher.register(EventCode.MOVE, (moveData, senderId): void => {
      const player = this.playerStateManager.getPlayer(senderId);
      if (player) {
        const isMe = senderId === this.getSocketId();
        if (isMe) {
          const dist = Vector3.Distance(
            new Vector3(player.position.x, player.position.y, player.position.z),
            new Vector3(moveData.position.x, moveData.position.y, moveData.position.z)
          );
          if (dist > 2.0) {
            // 서버와의 위치 불일치 감지! 위치 보정 필요시 여기에 로직 추가
          }
        } else {
          this.playerStateManager.updatePlayer(senderId, {
            position: { x: moveData.position.x, y: moveData.position.y, z: moveData.position.z },
            rotation: { x: moveData.rotation.x, y: moveData.rotation.y, z: moveData.rotation.z },
          });
        }
      }
    });

    this.dispatcher.register(EventCode.ENEMY_MOVE, (data): void => {
      this.onEnemyUpdated.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.ENEMY_HIT, (data): void => {
      this.onEnemyHit.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.TARGET_HIT, (data): void => {
      this.onTargetHit.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.PLAYER_DEATH, (data): void => {
      this.onPlayerDied.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.RESPAWN, (data): void => {
      this.onPlayerRespawn.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.GAME_END, (data): void => {
      this.onGameEnd.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.TARGET_DESTROY, (data): void => {
      this.onTargetDestroy.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.RELOAD, (data): void => {
      this.onPlayerReloaded.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.SPAWN_TARGET, (data): void => {
      this.onTargetSpawn.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.REQ_INITIAL_STATE, (_data, senderId): void => {
      this.onInitialStateRequested.notifyObservers({ senderId });
    });

    this.dispatcher.register(EventCode.INITIAL_STATE, (stateData): void => {
      this.onInitialStateReceived.notifyObservers({
        players: stateData.players,
        enemies: stateData.enemies,
        targets: stateData.targets,
        weaponConfigs: stateData.weaponConfigs,
      });
    });
  }

  private setupProviderListeners(): void {
    this.provider.onStateChanged = (state: NetworkState): void => {
      this.connectionManager.handleStateChange(state);
    };

    this.provider.onRoomListUpdated = (rooms: RoomInfo[]): void => {
      this.roomManager.handleRoomListUpdate(rooms);
    };

    this.provider.onPlayerJoined = (user: { userId: string; name?: string }): void => {
      this.playerStateManager.registerPlayer({
        id: user.userId,
        name: user.name || 'Anonymous',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        weaponId: 'Pistol',
        health: 100,
      });
    };

    this.provider.onPlayerLeft = (id): void => {
      this.playerStateManager.removePlayer(id);
    };

    this.provider.onEvent = (code: number, data: unknown, senderId: string): void => {
      this.onEvent.notifyObservers({ code, data, senderId });
      if (this.isMasterClient() && this.isServerRequestEvent(code)) {
        return;
      }
      this.dispatchRawEvent(code, data, senderId);
    };

    this.provider.onMasterClientSwitched = (newMasterId: string): void => {
      const myId = this.getSocketId();
      if (myId === newMasterId) {
        // INetworkProvider 인터페이스를 통해 room name 획득
        const roomName = this.provider.getCurrentRoomName?.();
        this.handleTakeover(roomName || null);
      }
    };
  }

  // =================================================================
  // [New] Centralized Session Management (Host, Join, Leave, Takeover)
  // =================================================================

  /**
   * 게임 호스팅 (방 생성 + 로컬 서버 시작)
   */
  public async hostGame(
    roomName: string,
    mapId: string,
    gameMode: string = 'deathmatch'
  ): Promise<boolean> {
    // 1. 방 생성 (Create Room)
    const created = await this.roomManager.createRoom(roomName, mapId);
    if (!created) return false;

    // 2. 로컬 서버 시작 (Start Local Server)
    logger.info(`HostGame: Starting Local Server for ${roomName}`);
    await this.localServerManager.startSession(this, roomName, mapId, gameMode);

    // 3. 서버 인스턴스 등록 (Register Server Instance)
    this.setLocalServer(this.localServerManager.getLogicalServer());

    return true;
  }

  /**
   * 게임 참가 (방 참가 only)
   */
  public async joinGame(roomName: string): Promise<boolean> {
    const joined = await this.roomManager.joinRoom(roomName);
    if (!joined) return false;

    // Request initial state from Master Client
    logger.info(`Requesting Initial State for room ${roomName}...`);
    this.sendRequestToMaster(EventCode.REQ_INITIAL_STATE, {}, true);

    // 혹시 들어가자마자 방장인 경우 (방이 비어있었을 때 등) 체크
    if (this.isMasterClient()) {
      await this.handleTakeover(roomName);
    }
    return true;
  }

  /**
   * 게임 떠나기 (서버 종료 + 방 나가기 통합)
   */
  public leaveGame(): void {
    // 1. 내가 서버를 돌리고 있었다면 종료
    if (this.localServerManager.isServerRunning()) {
      logger.info('LeaveGame: Stopping Local Server...');
      this.localServerManager.stopSession();
      this.setLocalServer(null);
    }

    // 2. 방 나가기
    this.roomManager.leaveRoom();

    // 3. 옵저버 정리
    this.clearObservers('session');
  }

  /**
   * [Internal] 호스트 권한 위임 처리
   */
  private async handleTakeover(roomName: string | null): Promise<void> {
    if (!roomName) return;

    // 이미 서버가 돌고 있으면 패스
    if (this.localServerManager.isServerRunning()) return;

    logger.info('HandleTakeover: Taking over host duties...');
    await this.localServerManager.takeover(this, roomName);

    // 서버 인스턴스 등록
    this.setLocalServer(this.localServerManager.getLogicalServer());
  }

  // === Connection Methods (delegated) ===
  public async connect(userId: string): Promise<boolean> {
    return this.connectionManager.connect(userId);
  }

  // === Room Methods (delegated) ===
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

  // === Player State Methods ===
  public join(data: {
    position: Vector3;
    rotation: Vector3;
    weaponId: string;
    name: string;
  }): void {
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
    }
    this.updateState(data);
  }

  public updateState(data: { position: Vector3; rotation: Vector3; weaponId: string }): void {
    const myId = this.getSocketId();
    if (myId) {
      const payload = this.playerStateManager.createMovePayload(myId, data.position, data.rotation);
      this.sendRequestToMaster(EventCode.MOVE, payload, false);
    }
  }

  public getAllPlayerStates(): PlayerState[] {
    return this.playerStateManager.getAllPlayers();
  }

  // === Game Action Methods ===
  public fire(fireData: {
    weaponId: string;
    muzzleTransform?: {
      position: { x: number; y: number; z: number };
      direction: { x: number; y: number; z: number };
    };
  }): void {
    this.sendRequestToMaster(EventCode.FIRE, fireData, true);
  }

  public reload(weaponId: string): void {
    const myId = this.getSocketId();
    if (!myId) return;

    const payload = { playerId: myId, weaponId };
    this.sendRequestToMaster(EventCode.RELOAD, payload, true);
  }

  public syncWeapon(weaponId: string): void {
    this.sendRequestToMaster(EventCode.SYNC_WEAPON, { weaponId }, true);
  }

  public requestHit(hitData: RequestHitData): void {
    this.sendRequestToMaster(EventCode.REQUEST_HIT, hitData, true);
  }

  public sendEvent(code: number, data: unknown, reliable: boolean = true): void {
    if (this.isServerRequestEvent(code)) {
      this.sendRequestToMaster(code, data, reliable);
      return;
    }
    this.broadcastAuthorityEvent(code, data, reliable);
  }

  // === Utility Methods ===
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
    this.clearObservers('all');

    if (this.localServerManager.isServerRunning()) {
      this.localServerManager.stopSession();
      this.setLocalServer(null);
    }

    this.connectionManager.dispose();
    this.roomManager.dispose();
    this.playerStateManager.dispose();
    this.provider.disconnect();
  }
}
