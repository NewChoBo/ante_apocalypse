import { Observer } from '@babylonjs/core';
import { IServerNetworkAuthority, WorldEntityManager } from '@ante/game-core';
import {
  HitEventData,
  RequestHitData,
  PlayerState as NetworkPlayerState,
  Vector3 as NetworkVector3,
  InitialStatePayload,
  EventCode,
  DeathEventData,
  Logger,
  MovePayload,
  FireEventData,
  SyncWeaponPayload,
  ReloadEventData,
  RespawnEventData,
  EnemyMovePayload,
  EnemyHitPayload,
  EnemyDestroyPayload,
  TargetHitPayload,
  TargetDestroyPayload,
  SpawnTargetPayload,
  PickupDestroyPayload,
  GameEndEventData,
} from '@ante/common';
import { NetworkManager } from '../systems/NetworkManager';

const logger = new Logger('ClientHostNetworkAdapter');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isVector3Like(value: unknown): value is NetworkVector3 {
  return (
    isRecord(value) &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    typeof value.z === 'number'
  );
}

function isMovePayload(value: unknown): value is MovePayload {
  return (
    isRecord(value) && isVector3Like(value.position) && isVector3Like(value.rotation)
  );
}

function isFireEventData(value: unknown): value is FireEventData {
  if (!isRecord(value) || typeof value.weaponId !== 'string') return false;
  if (value.muzzleTransform === undefined) return true;
  return (
    isRecord(value.muzzleTransform) &&
    isVector3Like(value.muzzleTransform.position) &&
    isVector3Like(value.muzzleTransform.direction)
  );
}

function isSyncWeaponPayload(value: unknown): value is SyncWeaponPayload {
  return isRecord(value) && typeof value.weaponId === 'string';
}

function isReloadEventData(value: unknown): value is ReloadEventData {
  return (
    isRecord(value) &&
    typeof value.playerId === 'string' &&
    typeof value.weaponId === 'string'
  );
}

function isRequestHitData(value: unknown): value is RequestHitData {
  return (
    isRecord(value) &&
    typeof value.targetId === 'string' &&
    typeof value.damage === 'number' &&
    typeof value.weaponId === 'string' &&
    isVector3Like(value.origin) &&
    isVector3Like(value.direction)
  );
}

function isHitEventData(value: unknown): value is HitEventData {
  return (
    isRecord(value) &&
    typeof value.targetId === 'string' &&
    typeof value.attackerId === 'string' &&
    typeof value.damage === 'number' &&
    typeof value.newHealth === 'number'
  );
}

function isDeathEventData(value: unknown): value is DeathEventData {
  return (
    isRecord(value) &&
    typeof value.targetId === 'string' &&
    typeof value.attackerId === 'string'
  );
}

function isRespawnEventData(value: unknown): value is RespawnEventData {
  return (
    isRecord(value) &&
    typeof value.playerId === 'string' &&
    isVector3Like(value.position)
  );
}

function isEnemyMovePayload(value: unknown): value is EnemyMovePayload {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isVector3Like(value.position) &&
    isVector3Like(value.rotation)
  );
}

function isEnemyHitPayload(value: unknown): value is EnemyHitPayload {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.damage === 'number'
  );
}

function isEnemyDestroyPayload(value: unknown): value is EnemyDestroyPayload {
  return isRecord(value) && typeof value.id === 'string';
}

function isTargetHitPayload(value: unknown): value is TargetHitPayload {
  return (
    isRecord(value) &&
    typeof value.targetId === 'string' &&
    typeof value.part === 'string' &&
    typeof value.damage === 'number'
  );
}

function isTargetDestroyPayload(value: unknown): value is TargetDestroyPayload {
  return isRecord(value) && typeof value.targetId === 'string';
}

function isSpawnTargetPayload(value: unknown): value is SpawnTargetPayload {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.isMoving === 'boolean' &&
    isVector3Like(value.position)
  );
}

function isPickupDestroyPayload(value: unknown): value is PickupDestroyPayload {
  return isRecord(value) && typeof value.id === 'string';
}

function isInitialStatePayload(value: unknown): value is InitialStatePayload {
  return (
    isRecord(value) &&
    Array.isArray(value.players) &&
    Array.isArray(value.enemies)
  );
}

function isGameEndEventData(value: unknown): value is GameEndEventData {
  return isRecord(value) && typeof value.reason === 'string';
}

interface ServerPlayerEntityLike {
  id: string;
  name: string;
  type: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  weaponId?: string;
  health: number;
  isDead?: boolean;
}

function isServerPlayerEntityLike(entity: unknown): entity is ServerPlayerEntityLike {
  return (
    isRecord(entity) &&
    (entity.type === 'remote_player' || entity.type === 'player') &&
    typeof entity.id === 'string' &&
    typeof entity.name === 'string' &&
    isVector3Like(entity.position) &&
    isVector3Like(entity.rotation) &&
    typeof entity.health === 'number'
  );
}

export class ClientHostNetworkAdapter implements IServerNetworkAuthority {
  private entityManager: WorldEntityManager;

  // Callbacks
  public onPlayerJoin?: (id: string, name: string) => void;
  public onPlayerLeave?: (id: string) => void;
  public onPlayerMove?: (id: string, pos: NetworkVector3, rot: NetworkVector3) => void;
  public onFireRequest?: (
    id: string,
    origin: NetworkVector3,
    dir: NetworkVector3,
    weaponId?: string
  ) => void;
  public onReloadRequest?: (playerId: string, weaponId: string) => void;
  public onHitRequest?: (shooterId: string, data: RequestHitData) => void;
  public onSyncWeaponRequest?: (playerId: string, weaponId: string) => void;
  public onPlayerDeath?: (targetId: string, attackerId: string) => void;

  private playerJoinObserver: Observer<NetworkPlayerState> | null = null;
  private playerLeaveObserver: Observer<string> | null = null;
  private rawEventObserver: Observer<{ code: number; data: unknown; senderId: string }> | null =
    null;

  constructor(
    private networkManager: NetworkManager,
    entityManager: WorldEntityManager
  ) {
    this.entityManager = entityManager;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.playerJoinObserver = this.networkManager.onPlayerJoined.add((player) => {
      if (this.onPlayerJoin) this.onPlayerJoin(player.id, player.name);
    });

    this.playerLeaveObserver = this.networkManager.onPlayerLeft.add((id) => {
      if (this.onPlayerLeave) this.onPlayerLeave(id);
    });

    this.rawEventObserver = this.networkManager.onEvent.add(({ code, data, senderId }) => {
      this.handleRawEvent(code, data, senderId);
    });
  }

  private handleRawEvent(code: number, data: unknown, senderId: string): void {
    if (senderId === NetworkManager.AUTHORITY_LOOPBACK_SENDER_ID) {
      return;
    }

    switch (code) {
      case EventCode.MOVE: {
        if (!isMovePayload(data)) return;
        if (this.onPlayerMove) {
          this.onPlayerMove(senderId, data.position, data.rotation);
        }
        break;
      }
      case EventCode.FIRE: {
        if (!isFireEventData(data) || !data.muzzleTransform) return;
        if (this.onFireRequest) {
          this.onFireRequest(
            senderId,
            data.muzzleTransform.position,
            data.muzzleTransform.direction,
            data.weaponId
          );
        }
        break;
      }
      case EventCode.SYNC_WEAPON: {
        if (!isSyncWeaponPayload(data)) return;
        if (this.onSyncWeaponRequest) {
          this.onSyncWeaponRequest(senderId, data.weaponId);
        }
        break;
      }
      case EventCode.RELOAD: {
        if (!isReloadEventData(data)) return;
        if (data.playerId === senderId && this.onReloadRequest) {
          this.onReloadRequest(senderId, data.weaponId);
        }
        break;
      }
      case EventCode.REQUEST_HIT: {
        if (!isRequestHitData(data)) return;
        if (this.onHitRequest) {
          this.onHitRequest(senderId, data);
        }
        break;
      }
      case EventCode.REQ_INITIAL_STATE: {
        logger.info(`HostAdapter: Received Initial State Request from ${senderId}`);
        this.broadcastState([], true);
        break;
      }
    }
  }

  public getSocketId(): string | undefined {
    return this.networkManager.getSocketId();
  }

  public isMasterClient(): boolean {
    return this.networkManager.isMasterClient();
  }

  public async createGameRoom(_name?: string, _mapId?: string): Promise<void> {
    if (!this.networkManager.isMasterClient()) {
      throw new Error('ClientHostNetworkAdapter requires Client to be Master.');
    }
    logger.info('createGameRoom called on Adapter - interacting with existing room.');
  }

  public async joinGameRoom(_name: string): Promise<void> {
    logger.info('joinGameRoom called on Adapter - interacting with existing room.');
  }

  public registerAllActors(): void {
    const players = this.networkManager.getAllPlayerStates();
    logger.info(
      `HostAdapter: registerAllActors found ${players.length} players`,
      players.map((p) => p.id)
    );
    players.forEach((player) => {
      if (this.onPlayerJoin) {
        logger.info(`HostAdapter: Registering existing player ${player.id} (${player.name})`);
        this.onPlayerJoin(player.id, player.name);
      }
    });
  }

  public sendEvent(code: number, data: unknown, reliable: boolean = true): void {
    this.networkManager.broadcastAuthorityEvent(code, data, reliable);

    switch (code) {
      case EventCode.PLAYER_DEATH:
        if (isDeathEventData(data)) {
          this.networkManager.onPlayerDied.notifyObservers(data);
        }
        break;
      case EventCode.RESPAWN:
        if (isRespawnEventData(data)) {
          this.networkManager.onPlayerRespawn.notifyObservers(data);
        }
        break;
      case EventCode.HIT:
        if (isHitEventData(data)) {
          this.networkManager.onPlayerHit.notifyObservers(data);
        }
        break;
      case EventCode.FIRE:
        if (isFireEventData(data) && typeof data.playerId === 'string') {
          this.networkManager.onPlayerFired.notifyObservers(data);
        }
        break;
      case EventCode.RELOAD:
        if (isReloadEventData(data)) {
          this.networkManager.onPlayerReloaded.notifyObservers(data);
        }
        break;
      case EventCode.ENEMY_MOVE:
        if (isEnemyMovePayload(data)) {
          this.networkManager.onEnemyUpdated.notifyObservers(data);
        }
        break;
      case EventCode.ENEMY_HIT:
        if (isEnemyHitPayload(data)) {
          this.networkManager.onEnemyHit.notifyObservers(data);
        }
        break;
      case EventCode.DESTROY_ENEMY:
        if (isEnemyDestroyPayload(data)) {
          this.networkManager.onEnemyDestroyed.notifyObservers(data);
        }
        break;
      case EventCode.TARGET_HIT:
        if (isTargetHitPayload(data)) {
          this.networkManager.onTargetHit.notifyObservers(data);
        }
        break;
      case EventCode.TARGET_DESTROY:
        if (isTargetDestroyPayload(data)) {
          this.networkManager.onTargetDestroy.notifyObservers(data);
        }
        break;
      case EventCode.SPAWN_TARGET:
        if (isSpawnTargetPayload(data)) {
          this.networkManager.onTargetSpawn.notifyObservers(data);
        }
        break;
      case EventCode.DESTROY_PICKUP:
        if (isPickupDestroyPayload(data)) {
          this.networkManager.onPickupDestroyed.notifyObservers(data);
        }
        break;
      case EventCode.INITIAL_STATE:
        if (isInitialStatePayload(data)) {
          this.networkManager.onInitialStateReceived.notifyObservers(data);
        }
        break;
      case EventCode.GAME_END:
        if (isGameEndEventData(data)) {
          this.networkManager.onGameEnd.notifyObservers(data);
        }
        break;
    }
  }

  public broadcastState(
    enemyStates: {
      id: string;
      position: NetworkVector3;
      rotation: NetworkVector3;
      health: number;
      isDead: boolean;
    }[] = [],
    reliable: boolean = false
  ): void {
    const entities = this.entityManager.getAllEntities();
    const players: NetworkPlayerState[] = [];

    for (const entity of entities) {
      if (isServerPlayerEntityLike(entity)) {
        players.push({
          id: entity.id,
          name: entity.name,
          position: { x: entity.position.x, y: entity.position.y, z: entity.position.z },
          rotation: { x: entity.rotation.x, y: entity.rotation.y, z: entity.rotation.z },
          weaponId: entity.weaponId || 'Pistol',
          health: entity.health,
          isDead: entity.isDead,
        });
      }
    }

    if (reliable) {
      logger.info(
        `HostAdapter: broadcastState found ${entities.length} total entities. Filtered Players: ${players.length}`,
        entities.map((e) => `${e.type}:${e.id}`)
      );
    }

    if (players.length === 0 && enemyStates.length === 0) return;

    const payload: InitialStatePayload = {
      players,
      enemies: enemyStates,
      targets: [],
    };

    if (reliable || Math.random() < 0.01) {
      logger.info(
        `HostAdapter Broadcasting State (Reliable=${reliable}): ${players.length} Players, ${enemyStates.length} Enemies. Names: ${players.map((p) => p.name).join(', ')}`
      );
    }

    this.networkManager.sendEvent(EventCode.INITIAL_STATE, payload, reliable);
  }

  public broadcastHit(hitData: HitEventData, code: number = EventCode.HIT): void {
    this.networkManager.sendEvent(code, hitData, true);
  }

  public broadcastDeath(targetId: string, attackerId: string): void {
    const payload: DeathEventData = {
      targetId,
      attackerId,
    };
    this.networkManager.sendEvent(EventCode.PLAYER_DEATH, payload, true);
    if (this.onPlayerDeath) this.onPlayerDeath(targetId, attackerId);
  }

  public broadcastRespawn(playerId: string, position: NetworkVector3): void {
    const payload = {
      playerId,
      position,
    };
    this.networkManager.sendEvent(EventCode.RESPAWN, payload, true);
  }

  public broadcastReload(playerId: string, weaponId: string): void {
    this.networkManager.sendEvent(
      EventCode.RELOAD,
      {
        playerId,
        weaponId,
      },
      true
    );
  }

  public getPlayerState(id: string): NetworkPlayerState | undefined {
    const entity = this.entityManager.getEntity(id);
    if (isServerPlayerEntityLike(entity)) {
      return {
        id: entity.id,
        name: entity.name,
        position: { x: entity.position.x, y: entity.position.y, z: entity.position.z },
        rotation: { x: entity.rotation.x, y: entity.rotation.y, z: entity.rotation.z },
        weaponId: entity.weaponId || 'Pistol',
        health: entity.health,
      };
    }
    return undefined;
  }

  public getCurrentRoomProperty<T = unknown>(_key: string): T | undefined {
    return this.networkManager.getCurrentRoomProperty<T>(_key);
  }

  public disconnect(): void {
    logger.info('ClientHostNetworkAdapter disconnected (virtual).');
  }

  public dispose(): void {
    if (this.playerJoinObserver) {
      this.networkManager.onPlayerJoined.remove(this.playerJoinObserver);
      this.playerJoinObserver = null;
    }
    if (this.playerLeaveObserver) {
      this.networkManager.onPlayerLeft.remove(this.playerLeaveObserver);
      this.playerLeaveObserver = null;
    }
    if (this.rawEventObserver) {
      this.networkManager.onEvent.remove(this.rawEventObserver);
      this.rawEventObserver = null;
    }
  }
}
