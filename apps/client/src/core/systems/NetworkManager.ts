import { Observable, Vector3 } from '@babylonjs/core';
import { INetworkProvider } from '../network/INetworkProvider';
import { PhotonProvider } from '../network/providers/PhotonProvider';
import { INetworkAuthority } from '@ante/game-core';
import {
  RoomInfo,
  NetworkState,
  EventCode,
  PlayerState,
  FireEventData,
  HitEventData,
  DeathEventData,
  RequestHitData,
} from '@ante/common';
import { WorldEntityManager, NetworkDispatcher } from '@ante/game-core';

export class NetworkManager implements INetworkAuthority {
  private static instance: NetworkManager;
  private provider: INetworkProvider;

  public onPlayersList = new Observable<PlayerState[]>();
  public onPlayerJoined = new Observable<PlayerState>();
  public onPlayerUpdated = new Observable<PlayerState>();
  public onPlayerLeft = new Observable<string>();
  public onPlayerFired = new Observable<FireEventData>();
  public onPlayerHit = new Observable<HitEventData>();
  public onPlayerDied = new Observable<DeathEventData>();

  // Enemy Synchronization
  public onEnemyUpdated = new Observable<{
    id: string;
    position: any;
    rotation: any;
    isMoving?: boolean;
  }>();
  public onEnemyHit = new Observable<{ id: string; damage: number }>();

  // State Synchronization
  public onInitialStateRequested = new Observable<{ senderId: string }>();
  public onInitialStateReceived = new Observable<{
    players: any[];
    enemies: any[];
    targets?: any[];
    weaponConfigs?: Record<string, any>;
  }>();

  // New Observables for Lobby/State
  public onRoomListUpdated = new Observable<RoomInfo[]>();
  public onStateChanged = new Observable<NetworkState>();
  public onEvent = new Observable<{ code: number; data: any; senderId: string }>();

  // Target Observables
  public onTargetHit = new Observable<{ targetId: string; part: string; damage: number }>();
  public onTargetDestroy = new Observable<{ targetId: string }>();
  public onTargetSpawn = new Observable<{
    type: string;
    position: Vector3;
    id: string;
    isMoving: boolean;
  }>();

  private entityManager: WorldEntityManager = new WorldEntityManager();
  private dispatcher: NetworkDispatcher = new NetworkDispatcher();

  public currentState: NetworkState = NetworkState.Disconnected;
  private lastRoomList: RoomInfo[] = [];

  private constructor() {
    this.provider = new PhotonProvider();
    this.setupDispatcher();
    this.setupProviderListeners();
  }

  public clearObservers(): void {
    this.onPlayersList.clear();
    this.onPlayerJoined.clear();
    this.onPlayerUpdated.clear();
    this.onPlayerLeft.clear();
    this.onPlayerFired.clear();
    this.onPlayerHit.clear();
    this.onPlayerDied.clear();
    this.onRoomListUpdated.clear();
    this.onStateChanged.clear();
  }

  public static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  private setupDispatcher(): void {
    this.dispatcher.register(EventCode.FIRE, (data, senderId) => {
      this.onPlayerFired.notifyObservers({
        playerId: senderId,
        weaponId: data.weaponId,
        muzzleTransform: data.muzzleTransform,
      });
    });

    this.dispatcher.register(EventCode.HIT, (data, senderId) => {
      this.onPlayerHit.notifyObservers({
        playerId: data.targetId,
        damage: data.damage,
        newHealth: data.newHealth || 0,
        attackerId: data.attackerId || senderId,
      });
    });

    this.dispatcher.register(EventCode.SYNC_WEAPON, (data, senderId) => {
      const entity = this.entityManager.getEntity(senderId);
      if (entity && entity.type === 'remote_player') {
        (entity as any).weaponId = data.weaponId;
        this.onPlayerUpdated.notifyObservers(entity as any);
      }
    });

    this.dispatcher.register(EventCode.MOVE, (data, senderId) => {
      const entity = this.entityManager.getEntity(senderId);
      if (entity && entity.type === 'remote_player') {
        const isMe = senderId === this.getSocketId();
        if (isMe) {
          const dist = Vector3.Distance(
            entity.position,
            new Vector3(data.position.x, data.position.y, data.position.z)
          );
          if (dist > 2.0) {
            console.warn('서버와의 위치 불일치 감지! 위치 보정됨.');
          }
        } else {
          entity.position.set(data.position.x, data.position.y, data.position.z);
          // rotation handling... (BasePawn might need rotation set)
          this.onPlayerUpdated.notifyObservers(entity as any);
        }
      }
    });

    this.dispatcher.register(EventCode.ENEMY_HIT, (data) => {
      this.onEnemyHit.notifyObservers({ id: data.id, damage: data.damage });
    });

    this.dispatcher.register(EventCode.TARGET_HIT, (data) => {
      this.onTargetHit.notifyObservers({
        targetId: data.targetId,
        part: data.part,
        damage: data.damage,
      });
    });

    this.dispatcher.register(EventCode.PLAYER_DEATH, (data) => {
      this.onPlayerDied.notifyObservers({
        playerId: data.playerId,
        attackerId: data.attackerId,
      });
    });

    this.dispatcher.register(EventCode.TARGET_DESTROY, (data) => {
      this.onTargetDestroy.notifyObservers({ targetId: data.targetId });
    });

    this.dispatcher.register(EventCode.SPAWN_TARGET, (data) => {
      this.onTargetSpawn.notifyObservers({
        type: data.type,
        position: new Vector3(data.position.x, data.position.y, data.position.z),
        id: data.id,
        isMoving: data.isMoving,
      });
    });

    this.dispatcher.register(EventCode.REQ_INITIAL_STATE, (_data, senderId) => {
      this.onInitialStateRequested.notifyObservers({ senderId });
    });

    this.dispatcher.register(EventCode.INITIAL_STATE, (data) => {
      if (data.players && Array.isArray(data.players)) {
        data.players.forEach((_p: PlayerState) => {
          // WorldEntityManager handles storage, but we still need to know if it's a PlayerState
          // In a full refactor, RemotePlayerPawn would be added to WorldEntityManager
        });
        console.log(`[NetworkManager] Synced ${data.players.length} players from Initial State`);
      }

      this.onInitialStateReceived.notifyObservers({
        players: data.players,
        enemies: data.enemies,
        targets: data.targets,
        weaponConfigs: data.weaponConfigs,
      });
    });
  }

  private setupProviderListeners(): void {
    this.provider.onStateChanged = (state) => {
      console.log(`[NetworkManager] Network state changed: ${this.currentState} -> ${state}`);
      this.currentState = state;
      this.onStateChanged.notifyObservers(state);

      // Auto-reconnect logic
      if (state === NetworkState.Disconnected || state === NetworkState.Error) {
        const userId = localStorage.getItem('playerName') || 'COMMANDER';
        console.warn(`[NetworkManager] Disconnected. Attempting auto-reconnect for ${userId}...`);

        // Reconnect after a delay to avoid spamming
        setTimeout(() => {
          if (
            this.currentState === NetworkState.Disconnected ||
            this.currentState === NetworkState.Error
          ) {
            this.connect(userId);
          }
        }, 3000);
      }
    };

    this.provider.onRoomListUpdated = (rooms) => {
      this.lastRoomList = rooms;
      this.onRoomListUpdated.notifyObservers(rooms);
    };

    this.provider.onPlayerJoined = (user) => {
      // NOTE: BasePawn-based registration should happen in MultiplayerSystem
      this.onPlayerJoined.notifyObservers({
        id: user.userId,
        name: user.name || 'Anonymous',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        weaponId: 'Pistol',
        health: 100,
      });
    };

    this.provider.onPlayerLeft = (id) => {
      this.entityManager.unregister(id);
      this.onPlayerLeft.notifyObservers(id);
    };

    this.provider.onEvent = (code, data, senderId) => {
      this.onEvent.notifyObservers({ code, data, senderId });
      this.dispatcher.dispatch(code, data, senderId);
    };
  }

  public connect(userId: string): void {
    // Prevent redundant connection attempts using internal state
    if (
      this.currentState !== NetworkState.Disconnected &&
      this.currentState !== NetworkState.Error
    ) {
      return;
    }

    this.provider.connect(userId).catch((e) => {
      console.error('[NetworkManager] Connect failed:', e);
    });
  }

  public async joinRoom(name: string): Promise<boolean> {
    if (
      this.currentState !== NetworkState.InLobby &&
      this.currentState !== NetworkState.ConnectedToMaster
    ) {
      console.warn(`[NetworkManager] Cannot join room: Invalid state ${this.currentState}`);
      return false;
    }
    return this.provider.joinRoom(name);
  }

  public leaveRoom(): void {
    this.provider.disconnect();
  }

  public isMasterClient(): boolean {
    return this.provider.isMasterClient();
  }

  public getActors(): Map<string, { id: string; name: string }> {
    return this.provider.getActors();
  }

  public getMapId(): string | null {
    return this.provider.getCurrentRoomProperty('mapId');
  }

  public join(data: {
    position: Vector3;
    rotation: Vector3;
    weaponId: string;
    name: string;
  }): void {
    const myId = this.getSocketId();
    if (myId) {
      const myState: PlayerState = {
        id: myId,
        name: data.name,
        position: { x: data.position.x, y: data.position.y, z: data.position.z },
        rotation: { x: data.rotation.x, y: data.rotation.y, z: data.rotation.z },
        weaponId: data.weaponId,
        health: 100,
      };
      (myState as any).type = 'remote_player';
      this.entityManager.register(myState as any);
    }
    this.updateState(data);
  }

  public updateState(data: { position: Vector3; rotation: Vector3; weaponId: string }): void {
    const myId = this.getSocketId();
    if (myId) {
      const state = this.entityManager.getEntity(myId) as unknown as PlayerState;
      if (state) {
        state.position = { x: data.position.x, y: data.position.y, z: data.position.z };
        state.rotation = { x: data.rotation.x, y: data.rotation.y, z: data.rotation.z };
        state.weaponId = data.weaponId;
      }
    }

    this.provider.sendEvent(
      EventCode.MOVE,
      {
        position: { x: data.position.x, y: data.position.y, z: data.position.z },
        rotation: { x: data.rotation.x, y: data.rotation.y, z: data.rotation.z },
      },
      false
    );
  }

  public fire(fireData: {
    weaponId: string;
    muzzleTransform?: {
      position: { x: number; y: number; z: number };
      direction: { x: number; y: number; z: number };
    };
  }): void {
    this.provider.sendEvent(EventCode.FIRE, fireData, true);
  }

  public syncWeapon(weaponId: string): void {
    this.provider.sendEvent(EventCode.SYNC_WEAPON, { weaponId }, true);
  }

  public requestHit(hitData: RequestHitData): void {
    this.provider.sendEvent(EventCode.REQUEST_HIT, hitData, true);
  }

  public sendEvent(code: number, data: any, reliable: boolean = true): void {
    this.provider.sendEvent(code, data, reliable);
  }

  public getSocketId(): string | undefined {
    return this.provider.getLocalPlayerId() || undefined;
  }

  public getServerTime(): number {
    return this.provider.getServerTime();
  }

  public refreshRoomList(): void {
    console.log('[NetworkManager] Requesting room list refresh...');
    this.provider.refreshRoomList?.();
  }

  public getRoomList(): RoomInfo[] {
    return this.lastRoomList;
  }

  public getAllPlayerStates(): PlayerState[] {
    return this.entityManager.getEntitiesByType('remote_player') as unknown as PlayerState[];
  }
}
