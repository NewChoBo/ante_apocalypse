import { Observable } from '@babylonjs/core';
import { NetworkManager } from './NetworkManager';
import {
  EventCode,
  NetworkState,
  PlayerData,
  EnemyUpdateData,
  TargetSpawnData,
  TargetDestroyData,
  PickupSpawnData,
  PickupDestroyData,
  ReqTryPickupPayload,
  ReqHitPayload,
  OnHitPayload,
  OnFiredPayload,
  OnAmmoSyncPayload,
  OnStateSyncPayload,
  OnStateDeltaPayload,
  OnMatchStateSyncPayload,
  OnMatchEndPayload,
  OnScoreSyncPayload,
  OnPosCorrectionPayload,
  EventData,
} from '../network/NetworkProtocol';

/**
 * Game logic systems and the low-level NetworkManager.
 * This prevents game systems from depending directly on Photon-specific logic.
 */
export class NetworkMediator {
  private static instance: NetworkMediator;
  private networkManager: NetworkManager;

  // Broadcasters for game systems to listen to
  public onPlayerJoined = new Observable<PlayerData>();
  public onPlayerLeft = new Observable<string>();
  public onPlayerUpdated = new Observable<PlayerData>();
  public onEnemyUpdated = new Observable<EnemyUpdateData>();
  public onTargetSpawnRequested = new Observable<TargetSpawnData>();
  public onTargetDestroyed = new Observable<TargetDestroyData>();
  public onPickupSpawnRequested = new Observable<PickupSpawnData>();
  public onPickupDestroyRequested = new Observable<PickupDestroyData>();

  // Authoritative Network Events
  public onStateSync = new Observable<OnStateSyncPayload>();
  public onStateDelta = new Observable<OnStateDeltaPayload>();
  public onMatchStateSync = new Observable<OnMatchStateSyncPayload>();
  public onMatchEnd = new Observable<OnMatchEndPayload>();
  public onScoreSync = new Observable<OnScoreSyncPayload>();
  public onPosCorrection = new Observable<OnPosCorrectionPayload>();

  public onPickupTryRequested = new Observable<ReqTryPickupPayload & { senderId: string }>();
  public onItemPicked = new Observable<{ id: string; type: string; ownerId: string }>();

  public onHitRequested = new Observable<ReqHitPayload & { shooterId: string }>();
  public onHit = new Observable<OnHitPayload>();
  public onFired = new Observable<OnFiredPayload>();
  public onPlayerDied = new Observable<{ playerId: string; attackerId: string }>();
  public onAmmoSynced = new Observable<OnAmmoSyncPayload>();

  public onStateChanged = new Observable<NetworkState>();

  // Raw event access if needed
  public onEvent = new Observable<{ code: number; data: EventData; senderId: string }>();

  private constructor() {
    this.networkManager = NetworkManager.getInstance();
    this.setupListeners();
  }

  public static getInstance(): NetworkMediator {
    if (!NetworkMediator.instance) {
      NetworkMediator.instance = new NetworkMediator();
    }
    return NetworkMediator.instance;
  }

  private setupListeners(): void {
    // Map low-level network events to game-level observables
    this.networkManager.onStateChanged.add((state) => {
      this.onStateChanged.notifyObservers(state);
    });

    this.networkManager.onPlayerJoined.add((data) => {
      const rot = data.rotation as { x: number; y: number; z: number; w?: number };
      const rotation = data.rotation ? { ...data.rotation, w: rot.w ?? 1 } : undefined;
      const playerData: PlayerData = { ...data, rotation };
      this.onPlayerJoined.notifyObservers(playerData);
    });

    this.networkManager.onPlayerLeft.add((id) => {
      this.onPlayerLeft.notifyObservers(id);
    });

    this.networkManager.onPlayerUpdated.add((data) => {
      const rot = data.rotation as { x: number; y: number; z: number; w?: number };
      const rotation = data.rotation ? { ...data.rotation, w: rot.w ?? 1 } : undefined;
      const playerData: PlayerData = { ...data, rotation };
      this.onPlayerUpdated.notifyObservers(playerData);
    });

    this.networkManager.onEnemyUpdated.add((data) => {
      this.onEnemyUpdated.notifyObservers(data);
    });

    this.networkManager.onTargetSpawn.add((data) => {
      this.onTargetSpawnRequested.notifyObservers(data);
    });

    this.networkManager.onTargetDestroy.add((data) => {
      this.onTargetDestroyed.notifyObservers(data);
    });

    this.networkManager.onEvent.add((event) => {
      // Forward to raw observers
      this.onEvent.notifyObservers(event);

      const { code, data, senderId } = event;

      if (code === EventCode.SPAWN_PICKUP) {
        this.onPickupSpawnRequested.notifyObservers(data as PickupSpawnData);
      } else if (code === EventCode.DESTROY_PICKUP) {
        this.onPickupDestroyRequested.notifyObservers(data as PickupDestroyData);
      } else if (code === EventCode.REQ_TRY_PICKUP) {
        this.onPickupTryRequested.notifyObservers({
          ...(data as ReqTryPickupPayload),
          senderId: senderId || '',
        });
      } else if (code === EventCode.ON_ITEM_PICKED) {
        this.onItemPicked.notifyObservers(data as { id: string; type: string; ownerId: string });
      } else if (code === EventCode.REQ_HIT) {
        this.onHitRequested.notifyObservers({
          ...(data as ReqHitPayload),
          shooterId: senderId || '',
        });
      } else if (code === EventCode.ON_HIT) {
        this.onHit.notifyObservers(data as OnHitPayload);
      } else if (code === EventCode.ON_FIRED) {
        this.onFired.notifyObservers(data as OnFiredPayload);
      } else if (code === EventCode.ON_AMMO_SYNC) {
        this.onAmmoSynced.notifyObservers(data as OnAmmoSyncPayload);
      } else if (code === EventCode.ON_STATE_SYNC) {
        this.onStateSync.notifyObservers(data as OnStateSyncPayload);
      } else if (code === EventCode.ON_STATE_DELTA) {
        this.onStateDelta.notifyObservers(data as OnStateDeltaPayload);
      } else if (code === EventCode.ON_MATCH_STATE_SYNC) {
        this.onMatchStateSync.notifyObservers(data as OnMatchStateSyncPayload);
      } else if (code === EventCode.ON_MATCH_END) {
        this.onMatchEnd.notifyObservers(data as OnMatchEndPayload);
      } else if (code === EventCode.ON_SCORE_SYNC) {
        this.onScoreSync.notifyObservers(data as OnScoreSyncPayload);
      } else if (code === EventCode.ON_POS_CORRECTION) {
        this.onPosCorrection.notifyObservers(data as OnPosCorrectionPayload);
      }
    });

    this.networkManager.onPlayerDied.add((data) => {
      this.onPlayerDied.notifyObservers(data);
    });
  }

  public sendEvent(code: EventCode, data: EventData, reliable: boolean = true): void {
    this.networkManager.sendEvent(code, data, reliable);
  }

  public isMasterClient(): boolean {
    return this.networkManager.isMasterClient();
  }

  public getSocketId(): string | undefined {
    return this.networkManager.getSocketId() || undefined;
  }
}
