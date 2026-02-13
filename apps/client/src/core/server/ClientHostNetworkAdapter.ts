import { Observer } from '@babylonjs/core';
import {
  IServerNetworkAuthority,
  WorldEntityManager,
  isRequestEventCode as isRequestTransportEventCode,
} from '@ante/game-core';
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
} from '@ante/common';
import { NetworkManager } from '../systems/NetworkManager';
import { isSamePlayerId } from '../network/identity';

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
    if (!isRequestTransportEventCode(code)) return;

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
        if (isSamePlayerId(data.playerId, senderId) && this.onReloadRequest) {
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
  }

  public sendRequest(code: number, data: unknown, reliable: boolean = true): void {
    this.networkManager.sendRequest(code, data, reliable);
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

    this.sendEvent(EventCode.INITIAL_STATE, payload, reliable);
  }

  public broadcastHit(hitData: HitEventData, code: number = EventCode.HIT): void {
    this.sendEvent(code, hitData, true);
  }

  public broadcastDeath(targetId: string, attackerId: string, respawnDelaySeconds?: number): void {
    const payload: DeathEventData = {
      targetId,
      attackerId,
      respawnDelaySeconds,
    };
    this.sendEvent(EventCode.PLAYER_DEATH, payload, true);
    if (this.onPlayerDeath) this.onPlayerDeath(targetId, attackerId);
  }

  public broadcastRespawn(playerId: string, position: NetworkVector3): void {
    const payload = {
      playerId,
      position,
    };
    this.sendEvent(EventCode.RESPAWN, payload, true);
  }

  public broadcastReload(playerId: string, weaponId: string): void {
    this.sendEvent(
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
