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
} from '@ante/common';
import { NetworkManager } from '../systems/NetworkManager';

const logger = new Logger('ClientHostNetworkAdapter');

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

  constructor(
    private networkManager: NetworkManager,
    entityManager: WorldEntityManager
  ) {
    this.entityManager = entityManager;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.networkManager.onPlayerJoined.add((player) => {
      if (this.onPlayerJoin) this.onPlayerJoin(player.id, player.name);
    });

    this.networkManager.onPlayerLeft.add((id) => {
      if (this.onPlayerLeave) this.onPlayerLeave(id);
    });

    // logicalServer needs raw updates for hitboxes/validation
    this.networkManager.onEvent.add(({ code, data, senderId }) => {
      // Dispatch via internal logic mapping
      this.handleRawEvent(code, data, senderId);
    });
  }

  private handleRawEvent(code: number, data: unknown, senderId: string): void {
    switch (code) {
      case EventCode.MOVE: {
        const moveData = data as MovePayload;
        if (this.onPlayerMove) {
          this.onPlayerMove(senderId, moveData.position, moveData.rotation);
        }
        break;
      }
      case EventCode.FIRE: {
        const fireData = data as FireEventData;
        if (this.onFireRequest && fireData.muzzleTransform) {
          this.onFireRequest(
            senderId,
            fireData.muzzleTransform.position,
            fireData.muzzleTransform.direction,
            fireData.weaponId
          );
        }
        break;
      }
      case EventCode.SYNC_WEAPON: {
        const syncData = data as SyncWeaponPayload;
        if (this.onSyncWeaponRequest) {
          this.onSyncWeaponRequest(senderId, syncData.weaponId);
        }
        break;
      }
      case EventCode.RELOAD: {
        const reloadData = data as ReloadEventData;
        if (reloadData.playerId === senderId && this.onReloadRequest) {
          this.onReloadRequest(senderId, reloadData.weaponId);
        }
        break;
      }
      case EventCode.REQUEST_HIT: {
        const hitData = data as RequestHitData;
        if (this.onHitRequest) {
          this.onHitRequest(senderId, hitData);
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

  // --- Interface Implementation ---

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
      // Manually trigger join for existing actors
      if (this.onPlayerJoin) {
        logger.info(`HostAdapter: Registering existing player ${player.id} (${player.name})`);
        this.onPlayerJoin(player.id, player.name);
      }
    });
  }

  public sendEvent(code: number, data: unknown, reliable: boolean = true): void {
    // [Unified]: NetworkManager handles central loopback via sendEvent
    this.networkManager.sendEvent(code, data, reliable);
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
      if (entity.type === 'remote_player' || entity.type === 'player') {
        const e = entity;
        if (e.position && e.rotation && e.name) {
          players.push({
            id: entity.id,
            name: e.name,
            position: { x: e.position.x, y: e.position.y, z: e.position.z },
            rotation: { x: e.rotation.x, y: e.rotation.y, z: e.rotation.z },
            weaponId: e.weaponId || 'Pistol',
            health: e.health,
            isDead: e.isDead,
          });
        }
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
      players: players,
      enemies: enemyStates,
      targets: [],
    };

    if (reliable || Math.random() < 0.01) {
      // Log critical updates or occasional stats
      logger.info(
        `HostAdapter Broadcasting State (Reliable=${reliable}): ${players.length} Players, ${enemyStates.length} Enemies. Names: ${players.map((p) => p.name).join(', ')}`
      );
    }

    // Periodic updates should be UNRELIABLE to prevent congestion
    this.networkManager.sendEvent(EventCode.INITIAL_STATE, payload, reliable);
  }

  public broadcastHit(hitData: HitEventData, code: number = EventCode.HIT): void {
    // Update local validation state if needed, then broadcast
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
    if (entity && (entity.type === 'player' || entity.type === 'remote_player')) {
      const e = entity;
      return {
        id: e.id,
        name: e.name || 'Anonymous',
        position: { x: e.position.x, y: e.position.y, z: e.position.z },
        rotation: { x: e.rotation.x, y: e.rotation.y, z: e.rotation.z },
        weaponId: e.weaponId || 'Pistol',
        health: e.health,
      };
    }
    return undefined;
  }

  public getCurrentRoomProperty<T = unknown>(_key: string): T | undefined {
    // NetworkManager -> RoomManager -> Provider
    // We might need to expose this in NetworkManager
    // For now, assume mapId is passed in or we can't easily get it without exposing method in NetworkManager.
    // Return undefined and let fallback handle it.
    return undefined;
  }

  public disconnect(): void {
    // No-op for adapter as it uses shared NetworkManager
    // We do NOT want to disconnect the NetworkManager here.
    logger.info('ClientHostNetworkAdapter disconnected (virtual).');
  }
}
