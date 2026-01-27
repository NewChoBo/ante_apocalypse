import { Observable } from '@babylonjs/core';
import { INetworkProvider } from './INetworkProvider';
import { PhotonProvider } from './providers/PhotonProvider';
import { ServerGameController } from '../server/ServerGameController';
import { GameObservables } from '../events/GameObservables';
import {
  RoomData,
  NetworkState,
  EventCode,
  EventData,
  MovePayload,
  ReqFirePayload,
  OnFiredPayload,
  SyncWeaponPayload,
  EnemyUpdateData,
  InitialStatePayload,
  TargetDestroyData,
  TargetSpawnData,
  ReqInitialStatePayload,
  PlayerData,
  ReqHitPayload,
  OnHitPayload,
  OnAmmoSyncPayload,
  OnDiedPayload,
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
  private serverController: ServerGameController | null = null;

  public onPlayersList = new Observable<PlayerData[]>();
  public onPlayerJoined = new Observable<PlayerData>();
  public onPlayerUpdated = new Observable<PlayerData>();
  public onPlayerLeft = new Observable<string>();

  // Game Logic Observables (Driven by ON_ events)
  public onPlayerFired = new Observable<FireEventData>();
  public onPlayerDied = new Observable<DeathEventData>();
  public onPlayerHit = new Observable<OnHitPayload>();
  public onAmmoSynced = new Observable<OnAmmoSyncPayload>();

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
      this.checkServerAuthority();
    };

    this.provider.onRoomListUpdated = (rooms): void => {
      this.lastRoomList = rooms;
      this.onRoomListUpdated.notifyObservers(rooms);
    };

    this.provider.onPlayerJoined = (user): void => {
      this.checkServerAuthority(); // Re-check, maybe user joined triggers something or I need to state-check
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
      // If master left, I might become master.
      // PhotonProvider usually updates isMasterClient internal flag before calling generic callbacks?
      // We rely on polling checkServerAuthority or provider specific hook.
      setTimeout(() => this.checkServerAuthority(), 100); // Slight delay to ensure Photon updated state
      this.onPlayerLeft.notifyObservers(id);
    };

    this.provider.onEvent = (code, data, senderId): void => {
      // 1. Notify Raw Observers (e.g. ServerGameController, NetworkMediator)
      this.onEvent.notifyObservers({ code, data, senderId });

      // 2. Process Notifications (ON_*) to update View/GameState
      switch (code) {
        case EventCode.MOVE: {
          const moveData = data as MovePayload;
          this.onPlayerUpdated.notifyObservers({
            id: senderId,
            name: 'Unknown',
            position: moveData.position,
            rotation: moveData.rotation,
            weaponId: moveData.weaponId || 'Pistol',
          });
          break;
        }
        case EventCode.ON_FIRED: {
          const fireData = data as OnFiredPayload;
          this.onPlayerFired.notifyObservers({
            playerId: fireData.shooterId,
            weaponId: fireData.weaponId,
            muzzleTransform: fireData.muzzleData,
          });

          // Also notify global GameObservables for UI/Animation logic
          GameObservables.weaponFire.notifyObservers({
            shooterId: fireData.shooterId,
            weaponId: fireData.weaponId,
            ammoRemaining: fireData.ammoRemaining,
            muzzleData: fireData.muzzleData,
          });
          break;
        }
        case EventCode.ON_HIT: {
          const hitData = data as OnHitPayload;
          this.onPlayerHit.notifyObservers(hitData);
          break;
        }
        case EventCode.ON_AMMO_SYNC: {
          const ammoData = data as OnAmmoSyncPayload;
          this.onAmmoSynced.notifyObservers(ammoData);
          break;
        }
        case EventCode.SYNC_WEAPON: {
          const syncData = data as SyncWeaponPayload;
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
        case EventCode.ON_DIED: {
          const deathData = data as OnDiedPayload;
          this.onPlayerDied.notifyObservers({
            playerId: deathData.victimId,
            attackerId: deathData.killerId || '',
          });

          // Notify global GameObservables
          GameObservables.onDied.notifyObservers(deathData);
          break;
        }
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
        // REQ_ events are ignored here (Handled by ServerGameController via onEvent)
      }
    };
  }

  /**
   * Gatekeeper Logic: Manages the Logical Server instance based on Authority.
   */
  public checkServerAuthority(): void {
    const isMaster = this.provider.isMasterClient();
    console.log(
      `[Network] Check Authority: Master=${isMaster}, ServerExists=${!!this.serverController}`
    );

    if (isMaster && !this.serverController) {
      this.serverController = new ServerGameController();
    } else if (!isMaster && this.serverController) {
      this.serverController.dispose();
      this.serverController = null;
    }
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
    this.provider.leaveRoom();
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

  public sendEvent(
    code: EventCode,
    data: EventData,
    reliable: boolean = true,
    target: 'others' | 'all' | 'master' = 'all'
  ): void {
    this.provider.sendEvent(code, data, reliable, target);
  }

  public requestFire(payload: ReqFirePayload): void {
    this.sendEvent(EventCode.REQ_FIRE, payload, true, 'master');
  }

  public requestHit(payload: ReqHitPayload): void {
    this.sendEvent(EventCode.REQ_HIT, payload, true, 'master');
  }

  public syncWeapon(weaponId: string): void {
    this.sendEvent(EventCode.SYNC_WEAPON, new SyncWeaponPayload(weaponId), true);
  }
}
