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
    // 1. Connection / Room Events from NetworkManager
    this.networkManager.onPlayerJoined.add((player) => {
      // logger.info(\`HostAdapter: Player Joined \${player.id}\`);
      if (this.onPlayerJoin) this.onPlayerJoin(player.id, player.name);
      // We also need to ensure they are registered in the Entity Manager for LogicalServer?
      // LogicalServer does this on its own via onPlayerJoin callback.
    });

    this.networkManager.onPlayerLeft.add((id) => {
      // logger.info(\`HostAdapter: Player Left \${id}\`);
      if (this.onPlayerLeave) this.onPlayerLeave(id);
    });

    // 2. Game Events from NetworkManager Observables
    // Note: NetworkManager already filters own events usually?
    // But for LogicalServer, we need ALL relevant inputs.

    // Move is tricky. NetworkManager handles standard interpolation.
    // logicalServer needs raw updates for hitboxes.
    this.networkManager.onEvent.add(({ code, data, senderId }) => {
      // Dispatch via internal logic mapping
      this.handleRawEvent(code, data, senderId);
    });
  }

  private handleRawEvent(code: number, data: unknown, senderId: string): void {
    // We can use the same dispatch logic as ServerNetworkAuthority or manual mapping.
    switch (code) {
      case EventCode.MOVE: {
        const moveData = data as any; // Cast for now
        if (this.onPlayerMove) {
          this.onPlayerMove(senderId, moveData.position, moveData.rotation);
        }
        break;
      }
      case EventCode.FIRE: {
        const fireData = data as any;
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
        const syncData = data as any;
        if (this.onSyncWeaponRequest) {
          this.onSyncWeaponRequest(senderId, syncData.weaponId);
        }
        break;
      }
      case EventCode.RELOAD: {
        const reloadData = data as any;
        if (reloadData.playerId === senderId && this.onReloadRequest) {
          this.onReloadRequest(senderId, reloadData.weaponId);
        }
        break;
      }
      case EventCode.REQUEST_HIT: {
        const hitData = data as any;
        if (this.onHitRequest) {
          this.onHitRequest(senderId, hitData);
        }
        break;
      }
      case EventCode.REQ_INITIAL_STATE: {
        logger.info(`HostAdapter: Received Initial State Request from ${senderId}`);
        // Send RELIABLE response to ensure joining player gets the state
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
    // The Host Client (NetworkManager) creates the room.
    // This adapter is used when the room already exists or is being created by the host.
    // So this might be a no-op or just verification.
    if (!this.networkManager.isMasterClient()) {
      throw new Error('ClientHostNetworkAdapter requires Client to be Master.');
    }
    // We assume room is already created by NetworkManager.hostGame() sequence.
    logger.info('createGameRoom called on Adapter - interacting with existing room.');
  }

  public async joinGameRoom(_name: string): Promise<void> {
    // Similarly, we assume we are already in.
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
    // 1. Send to others via Network
    this.networkManager.sendEvent(code, data, reliable);

    // 2. Loopback to Self (Host needs to process these authoritative events too)

    // Dispatch to specific observables expected by MultiplayerSystem/Game
    switch (code) {
      case EventCode.PLAYER_DEATH:
        this.networkManager.onPlayerDied.notifyObservers(data as any);
        break;
      case EventCode.RESPAWN:
        this.networkManager.onPlayerRespawn.notifyObservers(data as any);
        break;
      case EventCode.HIT:
        this.networkManager.onPlayerHit.notifyObservers(data as any);
        break;
      case EventCode.FIRE:
        this.networkManager.onPlayerFired.notifyObservers(data as any);
        break;
      case EventCode.RELOAD:
        this.networkManager.onPlayerReloaded.notifyObservers(data as any);
        break;
      case EventCode.SYNC_WEAPON:
        // Sync weapon might need internal state update? NetworkManager handles it via dispatcher usually.
        // But here we might just notify? NetworkManager doesn't have onWeaponSync observable...
        // It uses dispatcher register func.
        // So for dispatcher-only events, we might miss them unless we touch dispatcher or use specialized methods.
        // However, SYNC_WEAPON is crucial for loadout.
        break;

      case EventCode.ENEMY_MOVE:
        this.networkManager.onEnemyUpdated.notifyObservers(data as any);
        break;
      case EventCode.ENEMY_HIT:
        this.networkManager.onEnemyHit.notifyObservers(data as any);
        break;
      case EventCode.DESTROY_ENEMY:
        this.networkManager.onEnemyDestroyed.notifyObservers(data as any);
        break;

      case EventCode.TARGET_HIT:
        this.networkManager.onTargetHit.notifyObservers(data as any);
        break;
      case EventCode.TARGET_DESTROY:
        this.networkManager.onTargetDestroy.notifyObservers(data as any);
        break;
      case EventCode.SPAWN_TARGET:
        this.networkManager.onTargetSpawn.notifyObservers(data as any);
        break;

      case EventCode.DESTROY_PICKUP:
        this.networkManager.onPickupDestroyed.notifyObservers(data as any);
        break;

      case EventCode.INITIAL_STATE:
        // Host typically doesn't need its own initial state loopbacked usually,
        // as it HAS the state. But MultiplayerSystem might expect it to initialize?
        // MultiplayerSystem.onInitialStateReceived calls applyPlayerStates.
        // If Host calls this, it might re-apply states.
        // Likely safe or harmless, but helpful for consistency.
        this.networkManager.onInitialStateReceived.notifyObservers(data as any);
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
    // We need to implement the same logic as ServerNetworkAuthority.broadcastState
    // Gathering player states from entityManager?
    // The entityManager passed to constructor IS the Server one.
    // So we can read from it.

    const entities = this.entityManager.getAllEntities();
    const players: NetworkPlayerState[] = [];

    // Helper to identify ServerPlayerEntity type (duck typing or shared helper)
    // We duplicate simple logic here or expose helper from game-core.
    for (const entity of entities) {
      if (entity.type === 'remote_player' || entity.type === 'player') {
        const e = entity as any; // Cast to ServerPlayerEntity-like
        if (e.position && e.rotation && e.name) {
          players.push({
            id: entity.id,
            name: e.name,
            position: { x: e.position.x, y: e.position.y, z: e.position.z },
            rotation: { x: e.rotation.x, y: e.rotation.y, z: e.rotation.z },
            weaponId: e.weaponId || 'Pistol',
            health: e.health,
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
    // Read from Server EntityManager
    const entity = this.entityManager.getEntity(id);
    if (entity && (entity.type === 'player' || entity.type === 'remote_player')) {
      const e = entity as any;
      return {
        id: e.id,
        name: e.name,
        position: { x: e.position.x, y: e.position.y, z: e.position.z },
        rotation: { x: e.rotation.x, y: e.rotation.y, z: e.rotation.z },
        weaponId: e.weaponId,
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
