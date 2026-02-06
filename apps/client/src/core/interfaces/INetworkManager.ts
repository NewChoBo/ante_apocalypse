import { Observable, Vector3 } from '@babylonjs/core';
import {
  RoomInfo,
  NetworkState,
  PlayerState,
  FireEventData,
  HitEventData,
  DeathEventData,
  RequestHitData,
  EnemyMovePayload,
  EnemyHitPayload,
  EnemyDestroyPayload,
  PickupDestroyPayload,
  RespawnEventData,
  GameEndEventData,
  InitialStatePayload,
  TargetHitPayload,
  TargetDestroyPayload,
  SpawnTargetPayload,
} from '@ante/common';

export interface INetworkManager {
  // Player Observables
  readonly onPlayerJoined: Observable<PlayerState>;
  readonly onPlayerUpdated: Observable<PlayerState>;
  readonly onPlayerLeft: Observable<string>;

  // Connection Observables
  readonly onStateChanged: Observable<NetworkState>;
  readonly currentState: NetworkState;

  // Room Observables
  readonly onRoomListUpdated: Observable<RoomInfo[]>;

  // Game Events
  readonly onPlayersList: Observable<PlayerState[]>;
  readonly onPlayerFired: Observable<FireEventData>;
  readonly onPlayerReloaded: Observable<{ playerId: string; weaponId: string }>;
  readonly onPlayerHit: Observable<HitEventData>;
  readonly onPlayerDied: Observable<DeathEventData>;
  readonly onPlayerRespawn: Observable<RespawnEventData>;
  readonly onGameEnd: Observable<GameEndEventData>;

  // Enemy Synchronization
  readonly onEnemyUpdated: Observable<EnemyMovePayload>;
  readonly onEnemyHit: Observable<EnemyHitPayload>;
  readonly onEnemyDestroyed: Observable<EnemyDestroyPayload>;
  readonly onPickupDestroyed: Observable<PickupDestroyPayload>;

  // State Synchronization
  readonly onInitialStateRequested: Observable<{ senderId: string }>;
  readonly onInitialStateReceived: Observable<InitialStatePayload>;

  // Raw Event Observable
  readonly onEvent: Observable<{ code: number; data: unknown; senderId: string }>;

  // Target Observables
  readonly onTargetHit: Observable<TargetHitPayload>;
  readonly onTargetDestroy: Observable<TargetDestroyPayload>;
  readonly onTargetSpawn: Observable<SpawnTargetPayload>;

  // Methods
  connect(userId: string): Promise<boolean>;
  hostGame(roomName: string, mapId: string, gameMode?: string): Promise<boolean>;
  joinGame(roomName: string): Promise<boolean>;
  leaveGame(): void;
  joinRoom(name: string): Promise<boolean>;
  createRoom(name: string, mapId: string): Promise<boolean>;
  leaveRoom(): void;
  isMasterClient(): boolean;
  getActors(): Map<string, { id: string; name: string }>;
  getMapId(): string | null;
  refreshRoomList(): void;
  getRoomList(): RoomInfo[];
  join(data: { position: Vector3; rotation: Vector3; weaponId: string; name: string }): void;
  updateState(data: { position: Vector3; rotation: Vector3; weaponId: string }): void;
  getAllPlayerStates(): PlayerState[];
  fire(fireData: {
    weaponId: string;
    muzzleTransform?: {
      position: { x: number; y: number; z: number };
      direction: { x: number; y: number; z: number };
    };
  }): void;
  reload(weaponId: string): void;
  syncWeapon(weaponId: string): void;
  requestHit(hitData: RequestHitData): void;
  sendEvent(code: number, data: unknown, reliable?: boolean): void;
  getSocketId(): string | undefined;
  getServerTime(): number;
  clearObservers(): void;
}
