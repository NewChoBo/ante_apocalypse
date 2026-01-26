import { Observable } from '@babylonjs/core';
import { NetworkManager } from './NetworkManager';
import {
  EventCode,
  NetworkState,
  PlayerData,
  EnemyUpdateData,
  EnemySpawnData,
  EnemyDestroyData,
  TargetSpawnData,
  TargetDestroyData,
  PickupSpawnData,
  PickupDestroyData,
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
  public onEnemySpawnRequested = new Observable<EnemySpawnData>();
  public onEnemyDestroyRequested = new Observable<EnemyDestroyData>();
  public onTargetSpawnRequested = new Observable<TargetSpawnData>();
  public onTargetDestroyed = new Observable<TargetDestroyData>();
  public onPickupSpawnRequested = new Observable<PickupSpawnData>();
  public onPickupDestroyRequested = new Observable<PickupDestroyData>();
  public onStateChanged = new Observable<NetworkState>();

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
      // Ensure rotation has w component
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
      if (event.code === EventCode.SPAWN_ENEMY) {
        this.onEnemySpawnRequested.notifyObservers(event.data as EnemySpawnData);
      } else if (event.code === EventCode.DESTROY_ENEMY) {
        this.onEnemyDestroyRequested.notifyObservers(event.data as EnemyDestroyData);
      } else if (event.code === EventCode.SPAWN_PICKUP) {
        this.onPickupSpawnRequested.notifyObservers(event.data as PickupSpawnData);
      } else if (event.code === EventCode.DESTROY_PICKUP) {
        this.onPickupDestroyRequested.notifyObservers(event.data as PickupDestroyData);
      }
    });
  }

  /**
   * Universal method to send events through the mediator.
   */
  public sendEvent(code: EventCode, data: EventData, reliable: boolean = true): void {
    this.networkManager.sendEvent(code, data, reliable);
  }

  public isMasterClient(): boolean {
    return this.networkManager.isMasterClient();
  }

  public getSocketId(): string | undefined {
    return this.networkManager.getSocketId();
  }
}
