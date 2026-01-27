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
  PlayerData,
  ReqHitPayload,
  ConfirmHitPayload,
} from './NetworkProtocol';

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

  public onPlayersList = new Observable<PlayerData[]>();
  public onPlayerJoined = new Observable<PlayerData>();
  public onPlayerUpdated = new Observable<PlayerData>();
  public onPlayerLeft = new Observable<string>();
  public onPlayerFired = new Observable<FireEventData>();
  public onPlayerDied = new Observable<DeathEventData>();

  // Hit/Damage Events
  public onPlayerHit = new Observable<ConfirmHitPayload>();

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
      const newState: PlayerData = {
        id: user.userId,
        name: user.name || 'Anonymous',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        weaponId: 'Pistol',
        health: 100,
      };
      this.onPlayerJoined.notifyObservers(newState);
    };

    this.provider.onPlayerLeft = (id): void => {
      this.onPlayerLeft.notifyObservers(id);
    };

    this.provider.onEvent = (code, data, senderId): void => {
      this.onEvent.notifyObservers({ code, data, senderId });

      switch (code) {
        case EventCode.MOVE: {
          const moveData = data as MovePayload;
          // Stateless Relay: Pass data directly to observers
          this.onPlayerUpdated.notifyObservers({
            id: senderId,
            name: 'Unknown',
            position: moveData.position,
            rotation: moveData.rotation,
            weaponId: moveData.weaponId || 'Pistol',
          });
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
          // Stateless Relay
          this.onPlayerUpdated.notifyObservers({
            id: senderId,
            name: 'Unknown',
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            weaponId: syncData.weaponId,
          });
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
        case EventCode.REQ_FIRE: {
          if (this.isMasterClient()) {
            // Master Logic: Validate fire request (cooldown, ammo, etc.)
            // For now, simpler: just broadcast FIRE event
            const fireData = data as FirePayload;
            this.sendEvent(EventCode.FIRE, fireData, true);
          }
          break;
        }
        case EventCode.REQ_HIT: {
          if (this.isMasterClient()) {
            // Master Logic: Validate hit (raycast check, distance, etc.)
            // For now: Accept all hits and broadcast ConfirmHit
            const hitData = data as ReqHitPayload;
            const confirmData = new ConfirmHitPayload(
              hitData.targetId,
              hitData.damage,
              100 - hitData.damage // Placeholder: Real HP logic should be in a centralized state manager
            );
            this.sendEvent(EventCode.CONFIRM_HIT, confirmData, true);
          }
          break;
        }
        case EventCode.CONFIRM_HIT: {
          const confirmData = data as ConfirmHitPayload;
          this.onPlayerHit.notifyObservers(confirmData);
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

  public sendEvent(code: EventCode, data: EventData, reliable: boolean = true): void {
    this.provider.sendEvent(code, data, reliable);
  }

  public requestFire(payload: FirePayload): void {
    // Send Request to Master
    this.sendEvent(EventCode.REQ_FIRE, payload, true);
  }

  /**
   * @deprecated Use requestFire instead for Server Authority
   */
  public fire(payload: FirePayload): void {
    this.sendEvent(EventCode.FIRE, payload, true);
  }

  public requestHit(payload: ReqHitPayload): void {
    this.sendEvent(EventCode.REQ_HIT, payload, true);
  }

  public syncWeapon(weaponId: string): void {
    this.sendEvent(EventCode.SYNC_WEAPON, new SyncWeaponPayload(weaponId), true);
  }
}
