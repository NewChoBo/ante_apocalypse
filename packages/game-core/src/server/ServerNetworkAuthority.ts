// Removed unused Photon import
import {
  EventCode,
  PlayerState as NetworkPlayerState,
  FireEventData,
  HitEventData,
  DeathEventData,
  RequestHitData,
  Vector3 as NetworkVector3,
  MovePayload,
  InitialStatePayload,
  SyncWeaponPayload,
  Logger,
} from '@ante/common';
import { Vector3, AbstractMesh } from '@babylonjs/core';
import { WorldEntityManager } from '../simulation/WorldEntityManager.js';
import { BasePhotonClient } from '../network/BasePhotonClient.js';
import { IWorldEntity } from '../types/IWorldEntity.js';

const logger = new Logger('ServerNetworkAuthority');

// 내부적으로 사용하는 서버 측 플레이어 엔티티 타입
// IWorldEntity를 상속받되, 서버 로직에 필요한 속성들을 보장함.
interface ServerPlayerEntity extends IWorldEntity {
  rotation: Vector3; // Babylon Vector3
  name: string;
  weaponId: string;
}

function isServerPlayerEntity(entity: IWorldEntity | undefined): entity is ServerPlayerEntity {
  if (!entity) return false;
  // 타입 단언을 사용하여 안전하게 속성 존재 여부 확인
  const e = entity as unknown as ServerPlayerEntity;
  return (
    (e.type === 'remote_player' || e.type === 'player') &&
    e.rotation instanceof Vector3 &&
    typeof e.name === 'string'
  );
}

// NetworkVector3와 Babylon Vector3 변환 헬퍼
function toNetworkVector3(v: Vector3): NetworkVector3 {
  return { x: v.x, y: v.y, z: v.z };
}

function toBabylonVector3(v: NetworkVector3): Vector3 {
  return new Vector3(v.x, v.y, v.z);
}

export class ServerNetworkAuthority extends BasePhotonClient {
  private entityManager: WorldEntityManager;

  // External callbacks
  public onPlayerJoin?: (id: string) => void;
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

  public getPlayerState(id: string): NetworkPlayerState | undefined {
    const entity = this.entityManager.getEntity(id);
    if (isServerPlayerEntity(entity)) {
      return {
        id: entity.id,
        name: entity.name,
        position: toNetworkVector3(entity.position),
        rotation: toNetworkVector3(entity.rotation),
        weaponId: entity.weaponId,
        health: entity.health,
      };
    }
    return undefined;
  }

  public isMasterClient(): boolean {
    return true; // The server is always the authority
  }

  public override getSocketId(): string | undefined {
    return 'server';
  }

  public override sendEvent(code: number, data: unknown, _reliable: boolean = true): void {
    this.sendEventToAll(code, data);
  }

  constructor(appId: string, appVersion: string, entityManager: WorldEntityManager) {
    super(appId, appVersion);
    this.entityManager = entityManager;

    this.setupDispatcher();
    this.setupServerCallbacks();
    this.setupJoinListener();
  }

  private setupJoinListener(): void {
    const originalOnStateChanged = this.onStateChanged;
    this.onStateChanged = (state: number): void => {
      originalOnStateChanged?.(state);

      if (this.isJoinedToRoom()) {
        logger.info('Joined Room - Registering all existing actors...');
        this.registerAllActors();
      }
    };
  }

  public registerAllActors(): void {
    const actors = this.getRoomActors();
    actors.forEach((info, nr) => {
      this.handleActorJoin(nr, info.name);
    });
  }

  private handleActorJoin(actorNr: number, name: string): void {
    const id = actorNr.toString();

    // Skip self
    if (id === this.getSocketId()) return;

    if (!this.entityManager.getEntity(id)) {
      logger.info(`Registering Actor: ${id} (${name})`);

      // ServerPlayerEntity 구현체 생성
      const playerEntity: ServerPlayerEntity = {
        id: id,
        name: name,
        type: 'remote_player',
        position: new Vector3(0, 0, 0),
        rotation: new Vector3(0, 0, 0),
        weaponId: 'Pistol',
        health: 100,
        maxHealth: 100,
        isActive: true,
        isDead: false,
        takeDamage: (_amount: number): void => {
          /* no-op */
        },
        die: (): void => {
          /* no-op */
        },
        dispose: (): void => {
          /* no-op */
        },
        // Mock mesh for server-side logic that doesn't use rendering
        mesh: {
          position: new Vector3(0, 0, 0),
          rotation: new Vector3(0, 0, 0),
          dispose: () => {},
        } as unknown as AbstractMesh,
      };

      this.entityManager.register(playerEntity);
    }

    if (this.onPlayerJoin) this.onPlayerJoin(id);
  }

  private setupDispatcher(): void {
    this.dispatcher.register(
      EventCode.REQ_INITIAL_STATE,
      (_data: unknown, senderId: string): void => {
        this.sendInitialState(senderId);
      }
    );

    this.dispatcher.register(EventCode.MOVE, (data: unknown, senderId: string): void => {
      const moveData = data as MovePayload;
      if (senderId === this.client.myActor().actorNr.toString()) return;

      const entity = this.entityManager.getEntity(senderId);

      if (!entity) {
        if (this.onPlayerJoin) this.onPlayerJoin(senderId);

        const actors = this.getRoomActors();
        const actorNr = parseInt(senderId);
        const name = actors.get(actorNr)?.name || 'Unknown';

        const newEntity: ServerPlayerEntity = {
          id: senderId,
          name: name,
          type: 'remote_player',
          position: toBabylonVector3(moveData.position),
          rotation: toBabylonVector3(moveData.rotation),
          weaponId: 'Pistol', // Default
          health: 100,
          maxHealth: 100,
          isActive: true,
          isDead: false,
          takeDamage: (): void => {
            /* no-op */
          },
          die: (): void => {
            /* no-op */
          },
          dispose: (): void => {
            /* no-op */
          },
          mesh: {
            position: new Vector3(0, 0, 0),
            rotation: new Vector3(0, 0, 0),
            dispose: () => {},
          } as unknown as AbstractMesh,
        };

        this.entityManager.register(newEntity);
      } else if (isServerPlayerEntity(entity)) {
        entity.position.copyFromFloats(
          moveData.position.x,
          moveData.position.y,
          moveData.position.z
        );
        // ServerPlayerEntity의 rotation은 Babylon Vector3
        entity.rotation.copyFromFloats(
          moveData.rotation.x,
          moveData.rotation.y,
          moveData.rotation.z
        );
      }

      if (this.onPlayerMove) {
        this.onPlayerMove(senderId, moveData.position, moveData.rotation);
      }
    });

    this.dispatcher.register(EventCode.SYNC_WEAPON, (data: unknown, senderId: string): void => {
      const syncData = data as SyncWeaponPayload;
      const entity = this.entityManager.getEntity(senderId);
      if (isServerPlayerEntity(entity)) {
        entity.weaponId = syncData.weaponId;
      }
      if (this.onSyncWeaponRequest) {
        this.onSyncWeaponRequest(senderId, syncData.weaponId);
      }
    });

    this.dispatcher.register(EventCode.FIRE, (data: unknown, senderId: string): void => {
      const fireData = data as FireEventData;
      if (this.onFireRequest && fireData.muzzleTransform) {
        this.onFireRequest(
          senderId,
          fireData.muzzleTransform.position,
          fireData.muzzleTransform.direction,
          fireData.weaponId
        );
      }
    });

    this.dispatcher.register(EventCode.RELOAD, (data: unknown, senderId: string): void => {
      const reloadData = data as { playerId: string; weaponId: string };
      // Security check
      if (reloadData.playerId !== senderId) return;
      if (this.onReloadRequest) {
        this.onReloadRequest(reloadData.playerId, reloadData.weaponId);
      }
    });

    this.dispatcher.register(EventCode.REQUEST_HIT, (data: unknown, senderId: string): void => {
      const hitData = data as RequestHitData;
      if (this.onHitRequest) {
        this.onHitRequest(senderId, hitData);
      }
    });
  }

  private setupServerCallbacks(): void {
    // Hook into base class callbacks
    this.onActorJoin = (actorNr: number, name: string): void => {
      this.handleActorJoin(actorNr, name);
    };

    this.onActorLeave = (actorNr: number): void => {
      const id = actorNr.toString();
      logger.info(`Player Left: ${id}`);
      this.entityManager.unregister(id);
      if (this.onPlayerLeave) this.onPlayerLeave(id);
    };
  }

  public async createGameRoom(name?: string, mapId?: string): Promise<void> {
    // 안전장치: 연결 끊김 상태 확인
    if (!this.client.isConnectedToMaster() && !this.client.isInLobby()) {
      logger.error('Cannot create room: Not connected.');
      throw new Error('Server disconnected from Photon.');
    }

    const roomName = name || 'TrainingGround_Server';
    const roomOptions = {
      isVisible: true,
      isOpen: true,
      maxPlayers: 20,
      customGameProperties: { mapId: mapId || 'training_ground' },
      propsListedInLobby: ['mapId'],
    };

    logger.info(`Creating Room: ${roomName} (Map: ${mapId})`);
    this.client.createRoom(roomName, roomOptions);
  }

  public async joinGameRoom(name: string): Promise<void> {
    if (!this.client.isConnectedToMaster() && !this.client.isInLobby()) {
      logger.error('Cannot join room: Not connected.');
      throw new Error('Server disconnected from Photon.');
    }
    logger.info(`Joining Room: ${name}`);
    this.client.joinRoom(name);
  }

  private sendInitialState(targetId: string): void {
    logger.info(`Sending Initial State to ${targetId}`);

    // IWorldEntity[] -> NetworkPlayerState[] 변환
    const entities = this.entityManager.getAllEntities();
    const players: NetworkPlayerState[] = [];

    for (const entity of entities) {
      if (isServerPlayerEntity(entity)) {
        players.push({
          id: entity.id,
          name: entity.name,
          position: toNetworkVector3(entity.position),
          rotation: toNetworkVector3(entity.rotation),
          weaponId: entity.weaponId,
          health: entity.health,
        });
      }
    }

    const payload: InitialStatePayload = {
      players,
      enemies: [],
      targets: [],
    };

    this.sendEventToActor(EventCode.INITIAL_STATE, payload, parseInt(targetId));
  }

  public broadcastState(
    enemyStates: {
      id: string;
      position: NetworkVector3; // NetworkVector3
      rotation: NetworkVector3; // NetworkVector3
      health: number;
      isDead: boolean;
    }[] = []
  ): void {
    const start = performance.now();
    const entities = this.entityManager.getAllEntities();
    const players: NetworkPlayerState[] = [];

    for (const entity of entities) {
      if (isServerPlayerEntity(entity)) {
        players.push({
          id: entity.id,
          name: entity.name,
          position: toNetworkVector3(entity.position),
          rotation: toNetworkVector3(entity.rotation),
          weaponId: entity.weaponId,
          health: entity.health,
        });
      }
    }

    if (players.length === 0) return;

    const payload: InitialStatePayload = {
      players: players,
      enemies: enemyStates,
      targets: [],
    };

    this.sendEventToAll(EventCode.INITIAL_STATE, payload);
    const end = performance.now();
    if (end - start > 10) {
      // logger.warn(`BroadcastState took ${end - start}ms`);
    }
  }

  public broadcastHit(hitData: HitEventData, code: number = EventCode.HIT): void {
    const entity = this.entityManager.getEntity(hitData.targetId);

    if (isServerPlayerEntity(entity)) {
      const wasAlive = entity.health > 0;
      entity.health = hitData.newHealth; // Map directly to entity

      logger.info(`Player ${hitData.targetId} Health: ${entity.health} (Part: ${hitData.part})`);

      this.sendEventToAll(code, hitData);

      if (wasAlive && entity.health <= 0) {
        this.broadcastDeath(hitData.targetId, hitData.attackerId);
      }
    } else {
      logger.info(`Non-player Hit Broadcasted: ${hitData.targetId} with Code ${code}`);
      this.sendEventToAll(code, hitData);
    }
  }

  public broadcastDeath(targetId: string, attackerId: string): void {
    logger.info(`💀 Player ${targetId} was killed by ${attackerId}`);
    const payload: DeathEventData = {
      targetId,
      attackerId,
    };
    this.sendEventToAll(EventCode.PLAYER_DEATH, payload);

    if (this.onPlayerDeath) {
      this.onPlayerDeath(targetId, attackerId);
    }
  }

  public broadcastRespawn(playerId: string, position: NetworkVector3): void {
    const entity = this.entityManager.getEntity(playerId);
    if (isServerPlayerEntity(entity)) {
      entity.health = 100;
      entity.position.copyFromFloats(position.x, position.y, position.z);
    }

    this.sendEventToAll(EventCode.RESPAWN, {
      playerId,
      position,
    });
  }

  public broadcastReload(playerId: string, weaponId: string): void {
    this.sendEventToAll(EventCode.RELOAD, {
      playerId,
      weaponId,
    });
  }
}
