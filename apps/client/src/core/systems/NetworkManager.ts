import { Observable, Vector3 } from '@babylonjs/core';
import { INetworkProvider } from '../network/INetworkProvider';
import { PhotonProvider } from '../network/providers/PhotonProvider';
import { INetworkAuthority, NetworkDispatcher, LogicalServer } from '@ante/game-core';
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
  SyncWeaponPayload,
  MovePayload,
  EnemyDestroyPayload,
  PickupDestroyPayload,
  RespawnEventData,
  GameEndEventData,
  Logger,
} from '@ante/common';
import { ConnectionManager } from '../network/ConnectionManager';
import { PlayerStateManager } from '../network/PlayerStateManager';
import { RoomManager } from '../network/RoomManager';

const logger = new Logger('NetworkManager');

/**
 * 네트워크 관리 Facade 클래스
 * 기존 API를 유지하면서 내부적으로 분리된 Manager들에 위임
 */
export class NetworkManager implements INetworkAuthority {
  private static instance: NetworkManager;
  private provider: INetworkProvider;

  // Sub-managers
  private connectionManager: ConnectionManager;
  private playerStateManager: PlayerStateManager;
  private roomManager: RoomManager;
  private dispatcher: NetworkDispatcher = new NetworkDispatcher();
  private localServer: LogicalServer | null = null;

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

  private constructor() {
    this.provider = new PhotonProvider();

    // Initialize sub-managers
    this.connectionManager = new ConnectionManager(this.provider);
    this.playerStateManager = new PlayerStateManager();
    this.roomManager = new RoomManager(this.provider, () => this.connectionManager.currentState);

    this.setupDispatcher();
    this.setupProviderListeners();
  }

  public clearObservers(): void {
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
    // this.onPlayersList.clear(); - Already cleared above

    this.playerStateManager.clearObservers();
  }

  public static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  public setLocalServer(server: LogicalServer | null): void {
    this.localServer = server;
    logger.info(`LocalServer ${server ? 'registered' : 'unregistered'} in NetworkManager`);
  }

  private setupDispatcher(): void {
    this.dispatcher.register(EventCode.FIRE, (data: unknown, senderId: string): void => {
      const fireData = data as FireEventData;
      this.onPlayerFired.notifyObservers({
        playerId: senderId,
        weaponId: fireData.weaponId,
        muzzleTransform: fireData.muzzleTransform,
      });
    });

    this.dispatcher.register(EventCode.HIT, (data: unknown): void => {
      this.onPlayerHit.notifyObservers(data as HitEventData);
    });

    this.dispatcher.register(EventCode.DESTROY_ENEMY, (data: unknown): void => {
      this.onEnemyDestroyed.notifyObservers(data as EnemyDestroyPayload);
    });

    this.dispatcher.register(EventCode.DESTROY_PICKUP, (data: unknown): void => {
      this.onPickupDestroyed.notifyObservers(data as PickupDestroyPayload);
    });

    this.dispatcher.register(EventCode.SYNC_WEAPON, (data: unknown, senderId: string): void => {
      const syncData = data as SyncWeaponPayload;
      this.playerStateManager.updatePlayer(senderId, { weaponId: syncData.weaponId });
    });

    this.dispatcher.register(EventCode.MOVE, (data: unknown, senderId: string): void => {
      const moveData = data as MovePayload;
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

    this.dispatcher.register(EventCode.ENEMY_MOVE, (data: unknown): void => {
      this.onEnemyUpdated.notifyObservers(data as EnemyMovePayload);
    });

    this.dispatcher.register(EventCode.TARGET_HIT, (data: unknown): void => {
      this.onTargetHit.notifyObservers(data as TargetHitPayload);
    });

    this.dispatcher.register(EventCode.PLAYER_DEATH, (data: unknown): void => {
      this.onPlayerDied.notifyObservers(data as DeathEventData);
    });

    this.dispatcher.register(EventCode.RESPAWN, (data: unknown): void => {
      this.onPlayerRespawn.notifyObservers(data as RespawnEventData);
    });

    this.dispatcher.register(EventCode.GAME_END, (data: unknown): void => {
      this.onGameEnd.notifyObservers(data as GameEndEventData);
    });

    this.dispatcher.register(EventCode.TARGET_DESTROY, (data: unknown): void => {
      this.onTargetDestroy.notifyObservers(data as TargetDestroyPayload);
    });

    this.dispatcher.register(EventCode.RELOAD, (data: unknown): void => {
      this.onPlayerReloaded.notifyObservers(data as { playerId: string; weaponId: string });
    });

    this.dispatcher.register(EventCode.SPAWN_TARGET, (data: unknown): void => {
      this.onTargetSpawn.notifyObservers(data as SpawnTargetPayload);
    });

    this.dispatcher.register(
      EventCode.REQ_INITIAL_STATE,
      (_data: unknown, senderId: string): void => {
        this.onInitialStateRequested.notifyObservers({ senderId });
      }
    );

    this.dispatcher.register(EventCode.INITIAL_STATE, (data: unknown): void => {
      const stateData = data as InitialStatePayload;
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
      this.dispatcher.dispatch(code, data, senderId);
    };

    this.provider.onMasterClientSwitched = (newMasterId: string): void => {
      const myId = this.getSocketId();
      if (myId === newMasterId) {
        // INetworkProvider 인터페이스를 통해 room name 획득
        const roomName = this.provider.getCurrentRoomName?.();
        if (roomName) {
          logger.info(`I AM THE NEW HOST - Triggering Takeover for Room: ${roomName}`);
          import('../server/LocalServerManager').then(({ LocalServerManager }) => {
            LocalServerManager.getInstance().takeover(roomName);
          });
        }
      }
    };
  }

  // === Connection Methods (delegated) ===
  public connect(userId: string): void {
    this.connectionManager.connect(userId);
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

      // Short-circuit for Master Client
      if (this.isMasterClient() && this.localServer) {
        this.localServer.updatePlayerPawn(myId, data.position, data.rotation);
      } else {
        this.provider.sendEvent(EventCode.MOVE, payload, false);
      }
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
    if (this.isMasterClient() && this.localServer && fireData.muzzleTransform) {
      this.localServer.processFireEvent(
        this.getSocketId()!,
        fireData.muzzleTransform.position,
        fireData.muzzleTransform.direction,
        fireData.weaponId
      );
    }
    this.provider.sendEvent(EventCode.FIRE, fireData, true);
  }

  public reload(weaponId: string): void {
    const myId = this.getSocketId();
    if (!myId) return;

    const payload = { playerId: myId, weaponId };
    this.provider.sendEvent(EventCode.RELOAD, payload, true);
  }

  public syncWeapon(weaponId: string): void {
    if (this.isMasterClient() && this.localServer) {
      this.localServer.processSyncWeapon(this.getSocketId()!, weaponId);
    } else {
      this.provider.sendEvent(EventCode.SYNC_WEAPON, { weaponId }, true);
    }
  }

  public requestHit(hitData: RequestHitData): void {
    if (this.isMasterClient() && this.localServer) {
      this.localServer.processHitRequest(this.getSocketId()!, hitData);
    } else {
      this.provider.sendEvent(EventCode.REQUEST_HIT, hitData, true);
    }
  }

  public sendEvent(code: number, data: unknown, reliable: boolean = true): void {
    this.provider.sendEvent(code, data, reliable);
  }

  // === Utility Methods ===
  public getSocketId(): string | undefined {
    return this.provider.getLocalPlayerId() || undefined;
  }

  public getServerTime(): number {
    return this.provider.getServerTime();
  }
}
