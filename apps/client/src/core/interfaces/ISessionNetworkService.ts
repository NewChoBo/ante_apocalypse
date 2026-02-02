import { Observable, Vector3 } from '@babylonjs/core';
import {
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
  NetworkState,
  RoomInfo,
} from '@ante/common';

/**
 * SessionController에서 사용하는 네트워크 서비스 인터페이스
 * NetworkManager와의 결합도를 낮추고 의존성 주입을 가능하게 합니다.
 */
export interface ISessionNetworkService {
  // === Connection Observables ===
  readonly onStateChanged: Observable<NetworkState>;
  readonly currentState: NetworkState;

  // === Player State Observables ===
  readonly onPlayerJoined: Observable<PlayerState>;
  readonly onPlayerUpdated: Observable<PlayerState>;
  readonly onPlayerLeft: Observable<string>;
  readonly onPlayersList: Observable<PlayerState[]>;

  // === Game Event Observables ===
  readonly onPlayerFired: Observable<FireEventData>;
  readonly onPlayerReloaded: Observable<{ playerId: string; weaponId: string }>;
  readonly onPlayerHit: Observable<HitEventData>;
  readonly onPlayerDied: Observable<DeathEventData>;
  readonly onPlayerRespawn: Observable<RespawnEventData>;
  readonly onGameEnd: Observable<GameEndEventData>;

  // === Enemy Synchronization Observables ===
  readonly onEnemyUpdated: Observable<EnemyMovePayload>;
  readonly onEnemyHit: Observable<EnemyHitPayload>;
  readonly onEnemyDestroyed: Observable<EnemyDestroyPayload>;
  readonly onPickupDestroyed: Observable<PickupDestroyPayload>;

  // === State Synchronization Observables ===
  readonly onInitialStateRequested: Observable<{ senderId: string }>;
  readonly onInitialStateReceived: Observable<InitialStatePayload>;

  // === Target Observables ===
  readonly onTargetHit: Observable<TargetHitPayload>;
  readonly onTargetDestroy: Observable<TargetDestroyPayload>;
  readonly onTargetSpawn: Observable<SpawnTargetPayload>;

  // === Room Observables ===
  readonly onRoomListUpdated: Observable<RoomInfo[]>;

  // === Connection Methods ===
  connect(userId: string): void;

  // === Room Methods ===
  joinRoom(name: string): Promise<boolean>;
  createRoom(name: string, mapId: string): Promise<boolean>;
  leaveRoom(): void;
  isMasterClient(): boolean;
  getActors(): Map<string, { id: string; name: string }>;
  getMapId(): string | null;
  refreshRoomList(): void;
  getRoomList(): RoomInfo[];

  // === Player State Methods ===
  join(data: { position: Vector3; rotation: Vector3; weaponId: string; name: string }): void;
  updateState(data: { position: Vector3; rotation: Vector3; weaponId: string }): void;
  getAllPlayerStates(): PlayerState[];
  getSocketId(): string | undefined;
  getServerTime(): number;

  // === Game Action Methods ===
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

  // === Observer Management ===
  clearObservers(): void;
}
