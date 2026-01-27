import { Observable } from '@babylonjs/core';
import { INetworkProvider } from './INetworkProvider';
import { PhotonProvider } from './providers/PhotonProvider';
import {
  RoomData,
  NetworkState,
  EventCode,
  EventData,
  MovePayload,
  FirePayload,
  SyncWeaponPayload,
  EnemyUpdateData,
  InitialStatePayload,
  PlayerDeathPayload,
  TargetDestroyData,
  TargetSpawnData,
  ReqInitialStatePayload,
} from './NetworkProtocol';

export interface PlayerState {
  id: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  weaponId: string;
  name: string;
  health: number;
}

export interface FireEventData {
  playerId: string;
  weaponId: string;
  muzzleTransform?: {
    position: { x: number; y: number; z: number };
    direction: { x: number; y: number; z: number };
  };
}

export interface DeathEventData {
  playerId: string;
  attackerId: string;
}

export class NetworkManager {
  private static instance: NetworkManager;
  private provider: INetworkProvider;
  private state: NetworkState = NetworkState.Disconnected;

  public onPlayersList = new Observable<PlayerState[]>();
  public onPlayerJoined = new Observable<PlayerState>();
  public onPlayerUpdated = new Observable<PlayerState>();
  public onPlayerLeft = new Observable<string>();
  public onPlayerFired = new Observable<FireEventData>();
  public onPlayerDied = new Observable<DeathEventData>();

  // Enemy Synchronization
  public onEnemyUpdated = new Observable<EnemyUpdateData>();

  // State Synchronization
  public onInitialStateRequested = new Observable<ReqInitialStatePayload & { senderId: string }>();
  public onInitialStateReceived = new Observable<InitialStatePayload>();

  // New Observables for Lobby/State
  public onRoomListUpdated = new Observable<RoomData[]>();
  public onStateChanged = new Observable<NetworkState>();
  public onEvent = new Observable<{ code: number; data: EventData; senderId: string }>();

  // Target Observables
  public onTargetDestroy = new Observable<TargetDestroyData>();
  public onTargetSpawn = new Observable<TargetSpawnData>();

  private playerStates: Map<string, PlayerState> = new Map();
  private lastRoomList: RoomData[] = [];

  private constructor() {
    this.provider = new PhotonProvider();
    this.setupProviderListeners();
  }

  public static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  private setupProviderListeners(): void {
    this.provider.onStateChanged = (state): void => {
      this.state = state;
      this.onStateChanged.notifyObservers(state);
    };

    this.provider.onRoomListUpdated = (rooms): void => {
      this.lastRoomList = rooms;
      this.onRoomListUpdated.notifyObservers(rooms);
    };

    this.provider.onPlayerJoined = (user): void => {
      const newState: PlayerState = {
        id: user.userId,
        name: user.name || 'Anonymous',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        weaponId: 'Pistol',
        health: 100,
      };
      this.playerStates.set(user.userId, newState);
      this.onPlayerJoined.notifyObservers(newState);
    };

    this.provider.onPlayerLeft = (id): void => {
      this.playerStates.delete(id);
      this.onPlayerLeft.notifyObservers(id);
    };

    this.provider.onEvent = (code, data, senderId): void => {
      this.onEvent.notifyObservers({ code, data, senderId });

      switch (code) {
        case EventCode.MOVE: {
          const moveData = data as MovePayload;
          if (this.playerStates.has(senderId)) {
            const state = this.playerStates.get(senderId)!;
            state.position = moveData.position;
            state.rotation = moveData.rotation;
            this.onPlayerUpdated.notifyObservers(state);
          }
          break;
        }
        case EventCode.FIRE: {
          const fireData = data as FirePayload;
          this.onPlayerFired.notifyObservers({
            playerId: senderId,
            weaponId: fireData.weaponId,
            muzzleTransform: fireData.muzzleData,
          });
          break;
        }
        case EventCode.SYNC_WEAPON: {
          const syncData = data as SyncWeaponPayload;
          if (this.playerStates.has(senderId)) {
            const state = this.playerStates.get(senderId)!;
            state.weaponId = syncData.weaponId;
            this.onPlayerUpdated.notifyObservers(state);
          }
          break;
        }
        case EventCode.ENEMY_MOVE:
          this.onEnemyUpdated.notifyObservers(data as EnemyUpdateData);
          break;
        case EventCode.PLAYER_DEATH:
          this.onPlayerDied.notifyObservers(data as PlayerDeathPayload);
          break;
        case EventCode.TARGET_DESTROY:
          this.onTargetDestroy.notifyObservers(data as TargetDestroyData);
          break;
        case EventCode.SPAWN_TARGET:
          this.onTargetSpawn.notifyObservers(data as TargetSpawnData);
          break;
        case EventCode.REQ_INITIAL_STATE:
          this.onInitialStateRequested.notifyObservers({
            ...(data as ReqInitialStatePayload),
            senderId,
          });
          break;
        case EventCode.INITIAL_STATE: {
          const initialState = data as InitialStatePayload;
          this.onInitialStateReceived.notifyObservers(initialState);
          break;
        }
      }
    };
  }

  public connect(userId: string): void {
    this.provider.connect(userId).catch((e) => {
      console.error('[NetworkManager] Connect failed:', e);
    });
  }

  public async createRoom(
    name: string,
    options?: { mapId: string; gameMode: string }
  ): Promise<boolean> {
    return this.provider.createRoom({
      roomName: name,
      mapId: options?.mapId || 'training_ground',
      gameMode: options?.gameMode || 'survival',
      maxPlayers: 4,
    });
  }

  public async joinRoom(name: string): Promise<boolean> {
    return this.provider.joinRoom(name);
  }

  public leaveRoom(): void {
    this.provider.disconnect();
  }

  public getState(): NetworkState {
    return this.state;
  }

  public isMasterClient(): boolean {
    return this.provider.isMasterClient();
  }

  public getActors(): Map<string, { id: string; name: string }> {
    return this.provider.getActors();
  }

  public getMapId(): string | null {
    return (this.provider.getCurrentRoomProperty('mapId') as string) || null;
  }

  public getRoomProperty(key: string): unknown {
    return this.provider.getCurrentRoomProperty(key);
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

  public getRoomList(): RoomData[] {
    return this.lastRoomList;
  }

  public getAllPlayerStates(): PlayerState[] {
    return Array.from(this.playerStates.values());
  }

  public sendEvent(code: EventCode, data: EventData, reliable: boolean = true): void {
    this.provider.sendEvent(code, data, reliable);
  }

  public fire(payload: FirePayload): void {
    this.sendEvent(EventCode.FIRE, payload, true);
  }

  public syncWeapon(weaponId: string): void {
    this.sendEvent(EventCode.SYNC_WEAPON, new SyncWeaponPayload(weaponId), true);
  }
}
