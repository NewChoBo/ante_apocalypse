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
} from '@ante/common';
import { NetworkDispatcher } from '@ante/game-core';

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
  public onEnemyUpdated = new Observable<EnemyMovePayload>();
  public onEnemyHit = new Observable<EnemyHitPayload>();
  public onEnemyDestroyed = new Observable<EnemyDestroyPayload>();
  public onPickupDestroyed = new Observable<PickupDestroyPayload>();

  // State Synchronization
  public onInitialStateRequested = new Observable<{ senderId: string }>();
  public onInitialStateReceived = new Observable<InitialStatePayload>();

  // New Observables for Lobby/State
  public onRoomListUpdated = new Observable<RoomInfo[]>();
  public onStateChanged = new Observable<NetworkState>();
  public onEvent = new Observable<{ code: number; data: unknown; senderId: string }>();

  // Target Observables
  public onTargetHit = new Observable<TargetHitPayload>();
  public onTargetDestroy = new Observable<TargetDestroyPayload>();
  public onTargetSpawn = new Observable<SpawnTargetPayload>();

  private players: Map<string, PlayerState> = new Map();
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
    this.dispatcher.register(EventCode.FIRE, (data: FireEventData, senderId: string) => {
      this.onPlayerFired.notifyObservers({
        playerId: senderId,
        weaponId: data.weaponId,
        muzzleTransform: data.muzzleTransform,
      });
    });

    this.dispatcher.register(EventCode.HIT, (data: HitEventData) => {
      this.onPlayerHit.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.DESTROY_ENEMY, (data: EnemyDestroyPayload) => {
      this.onEnemyDestroyed.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.DESTROY_PICKUP, (data: PickupDestroyPayload) => {
      this.onPickupDestroyed.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.SYNC_WEAPON, (data: SyncWeaponPayload, senderId: string) => {
      const player = this.players.get(senderId);
      if (player) {
        player.weaponId = data.weaponId;
        this.onPlayerUpdated.notifyObservers(player);
      }
    });

    this.dispatcher.register(EventCode.MOVE, (data: MovePayload, senderId: string) => {
      const player = this.players.get(senderId);
      if (player) {
        const isMe = senderId === this.getSocketId();
        if (isMe) {
          const dist = Vector3.Distance(
            new Vector3(player.position.x, player.position.y, player.position.z),
            new Vector3(data.position.x, data.position.y, data.position.z)
          );
          if (dist > 2.0) {
            // 서버와의 위치 불일치 감지! 위치 보정 필요시 여기에 로직 추가
          }
        } else {
          player.position = { x: data.position.x, y: data.position.y, z: data.position.z };
          player.rotation = { x: data.rotation.x, y: data.rotation.y, z: data.rotation.z };
          this.onPlayerUpdated.notifyObservers(player);
        }
      }
    });

    this.dispatcher.register(EventCode.ENEMY_MOVE, (data: EnemyMovePayload) => {
      this.onEnemyUpdated.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.TARGET_HIT, (data: TargetHitPayload) => {
      this.onTargetHit.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.PLAYER_DEATH, (data: DeathEventData) => {
      this.onPlayerDied.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.TARGET_DESTROY, (data: TargetDestroyPayload) => {
      this.onTargetDestroy.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.SPAWN_TARGET, (data: SpawnTargetPayload) => {
      this.onTargetSpawn.notifyObservers(data);
    });

    this.dispatcher.register(
      EventCode.REQ_INITIAL_STATE,
      (_data: unknown, senderId: string): void => {
        this.onInitialStateRequested.notifyObservers({ senderId });
      }
    );

    this.dispatcher.register(EventCode.INITIAL_STATE, (data: InitialStatePayload) => {
      if (data.players && Array.isArray(data.players)) {
        data.players.forEach((_p: PlayerState): void => {
          // WorldEntityManager handles storage, but we still need to know if it's a PlayerState
          // In a full refactor, RemotePlayerPawn would be added to WorldEntityManager
        });
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
    this.provider.onStateChanged = (state: NetworkState): void => {
      this.currentState = state;
      this.onStateChanged.notifyObservers(state);

      // Auto-reconnect logic
      if (state === NetworkState.Disconnected || state === NetworkState.Error) {
        const userId = localStorage.getItem('playerName') || 'COMMANDER';
        // Reconnect after a delay to avoid spamming
        setTimeout((): void => {
          if (
            this.currentState === NetworkState.Disconnected ||
            this.currentState === NetworkState.Error
          ) {
            this.connect(userId);
          }
        }, 3000);
      }
    };

    this.provider.onRoomListUpdated = (rooms: RoomInfo[]): void => {
      this.lastRoomList = rooms;
      this.onRoomListUpdated.notifyObservers(rooms);
    };

    this.provider.onPlayerJoined = (user: { userId: string; name?: string }): void => {
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
      this.players.delete(id);
      this.onPlayerLeft.notifyObservers(id);
    };

    this.provider.onEvent = (code: number, data: unknown, senderId: string): void => {
      this.onEvent.notifyObservers({ code, data, senderId });
      this.dispatcher.dispatch(code, data, senderId);
    };

    this.provider.onMasterClientSwitched = (newMasterId: string) => {
      const myId = this.getSocketId();
      // Let's rely on provider exposing it or infer it.
      // For now, let's use a method to get room name.

      if (myId === newMasterId) {
        // accessing room name from provider might be needed.
        // Im implementing a helper in NetworkManager first or just casting provider
        const roomName = (this.provider as any).client?.myRoom()?.name;

        if (roomName) {
          console.log(`!!! I AM THE NEW HOST !!! - Triggering Takeover for Room: ${roomName}`);
          import('../server/LocalServerManager').then(({ LocalServerManager }) => {
            LocalServerManager.getInstance().takeover(roomName);
          });
        }
      }
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

    this.provider.connect(userId).catch((_e): void => {
      // Connection failure handled via onStateChanged
    });
  }

  public async joinRoom(name: string): Promise<boolean> {
    if (
      this.currentState !== NetworkState.InLobby &&
      this.currentState !== NetworkState.ConnectedToMaster
    ) {
      return false;
    }
    return this.provider.joinRoom(name);
  }

  public async createRoom(name: string, mapId: string): Promise<boolean> {
    if (
      this.currentState !== NetworkState.InLobby &&
      this.currentState !== NetworkState.ConnectedToMaster
    ) {
      return false;
    }
    const options = {
      maxPlayers: 20,
      customGameProperties: { mapId },
      propsListedInLobby: ['mapId'],
    };
    return this.provider.createRoom(name, options);
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
      this.players.set(myId, myState);
    }
    this.updateState(data);
  }

  public updateState(data: { position: Vector3; rotation: Vector3; weaponId: string }): void {
    const myId = this.getSocketId();
    if (myId) {
      const state = this.players.get(myId);
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

  public sendEvent(code: number, data: unknown, reliable: boolean = true): void {
    this.provider.sendEvent(code, data, reliable);
  }

  public getSocketId(): string | undefined {
    return this.provider.getLocalPlayerId() || undefined;
  }

  public getServerTime(): number {
    return this.provider.getServerTime();
  }

  public refreshRoomList(): void {
    this.provider.refreshRoomList?.();
  }

  public getRoomList(): RoomInfo[] {
    return this.lastRoomList;
  }

  public getAllPlayerStates(): PlayerState[] {
    return Array.from(this.players.values());
  }
}
