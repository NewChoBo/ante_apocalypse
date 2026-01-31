// Removed unused Photon import
import {
  EventCode,
  PlayerState,
  FireEventData,
  HitEventData,
  DeathEventData,
  RequestHitData,
  Vector3,
  MovePayload,
  InitialStatePayload,
  SyncWeaponPayload,
  Logger,
} from '@ante/common';
import { WorldEntityManager } from '../simulation/WorldEntityManager.js';
import { BasePhotonClient } from '../network/BasePhotonClient.js';
import { IWorldEntity } from '../types/IWorldEntity.js';

const logger = new Logger('ServerNetworkAuthority');

export class ServerNetworkAuthority extends BasePhotonClient {
  private entityManager: WorldEntityManager = WorldEntityManager.getInstance();

  // External callbacks
  public onPlayerJoin?: (id: string) => void;
  public onPlayerLeave?: (id: string) => void;
  public onPlayerMove?: (id: string, pos: Vector3, rot: Vector3) => void;

  public onFireRequest?: (id: string, origin: Vector3, dir: Vector3, weaponId?: string) => void;
  public onReloadRequest?: (playerId: string, weaponId: string) => void;
  public onHitRequest?: (shooterId: string, data: RequestHitData) => void;
  public onPlayerDeath?: (targetId: string, attackerId: string) => void;

  public getPlayerState(id: string): PlayerState | undefined {
    return this.entityManager.getEntity(id) as unknown as PlayerState;
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

  constructor(appId: string, appVersion: string) {
    super(appId, appVersion);

    this.setupDispatcher();
    this.setupServerCallbacks();
  }

  private setupDispatcher(): void {
    this.dispatcher.register(EventCode.REQ_INITIAL_STATE, (_data: unknown, senderId: string) => {
      this.sendInitialState(senderId);
    });

    this.dispatcher.register(EventCode.MOVE, (data: unknown, senderId: string): void => {
      const moveData = data as MovePayload;
      if (senderId === this.client.myActor().actorNr.toString()) return;

      let entity = this.entityManager.getEntity(senderId) as unknown as PlayerState;
      if (!entity) {
        if (this.onPlayerJoin) this.onPlayerJoin(senderId);

        const actor = this.client.myRoom().actors[parseInt(senderId)];
        const name = actor?.name || 'Unknown';

        entity = {
          id: senderId,
          name: name,
          position: moveData.position,
          rotation: moveData.rotation,
          weaponId: 'Pistol',
          health: 100,
        };
        (entity as unknown as { type: string }).type = 'remote_player'; // IWorldEntity type
        this.entityManager.register(entity as unknown as IWorldEntity);
      } else {
        entity.position = moveData.position;
        entity.rotation = moveData.rotation;
      }

      if (this.onPlayerMove) {
        this.onPlayerMove(senderId, moveData.position, moveData.rotation);
      }
    });

    this.dispatcher.register(EventCode.SYNC_WEAPON, (data: unknown, senderId: string): void => {
      const syncData = data as SyncWeaponPayload;
      const state = this.getPlayerState(senderId);
      if (state) {
        state.weaponId = syncData.weaponId;
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
      const id = actorNr.toString();

      logger.info(`Player Joined: ${id} (${name})`);

      if (!this.entityManager.getEntity(id)) {
        const state: PlayerState = {
          id: id,
          name: name,
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          weaponId: 'Pistol',
          health: 100,
        };
        (state as unknown as { type: string }).type = 'remote_player';
        this.entityManager.register(state as unknown as IWorldEntity);
      }

      if (this.onPlayerJoin) this.onPlayerJoin(id);
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
    const players = this.entityManager.getAllEntities() as unknown as PlayerState[];
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
      position: Vector3;
      rotation: Vector3;
      health: number;
      isDead: boolean;
    }[] = []
  ): void {
    const players = this.entityManager.getAllEntities() as unknown as PlayerState[];
    if (players.length === 0) return;

    const payload: InitialStatePayload = {
      players: players,
      enemies: enemyStates,
      targets: [],
    };

    this.sendEventToAll(EventCode.INITIAL_STATE, payload);
  }

  public broadcastHit(hitData: HitEventData, code: number = EventCode.HIT): void {
    const targetState = this.getPlayerState(hitData.targetId);
    if (targetState) {
      const wasAlive = targetState.health > 0;
      targetState.health = hitData.newHealth;

      logger.info(
        `Player ${hitData.targetId} Health: ${targetState.health} (Part: ${hitData.part})`
      );

      this.sendEventToAll(code, hitData);

      if (wasAlive && targetState.health <= 0) {
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

  public broadcastRespawn(playerId: string, position: Vector3): void {
    const state = this.getPlayerState(playerId);
    if (state) {
      state.health = 100;
      state.position = position;
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
