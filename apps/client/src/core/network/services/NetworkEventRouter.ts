import { Observable, Vector3 } from '@babylonjs/core';
import { NetworkDispatcher, InboundTransportEvent } from '@ante/game-core';
import {
  EventCode,
  PlayerState,
  FireEventData,
  HitEventData,
  DeathEventData,
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
  PlayerInfo,
} from '@ante/common';
import { PlayerStateManager } from '../PlayerStateManager';

export class NetworkEventRouter {
  private readonly dispatcher = new NetworkDispatcher();

  public readonly onPlayersList = new Observable<PlayerState[]>();
  public readonly onPlayerFired = new Observable<FireEventData>();
  public readonly onPlayerReloaded = new Observable<{ playerId: string; weaponId: string }>();
  public readonly onPlayerHit = new Observable<HitEventData>();
  public readonly onPlayerDied = new Observable<DeathEventData>();
  public readonly onPlayerRespawn = new Observable<RespawnEventData>();
  public readonly onGameEnd = new Observable<GameEndEventData>();

  public readonly onEnemyUpdated = new Observable<EnemyMovePayload>();
  public readonly onEnemyHit = new Observable<EnemyHitPayload>();
  public readonly onEnemyDestroyed = new Observable<EnemyDestroyPayload>();
  public readonly onPickupDestroyed = new Observable<PickupDestroyPayload>();

  public readonly onInitialStateRequested = new Observable<{ senderId: string }>();
  public readonly onInitialStateReceived = new Observable<InitialStatePayload>();

  public readonly onEvent = new Observable<{ code: number; data: unknown; senderId: string }>();

  public readonly onTargetHit = new Observable<TargetHitPayload>();
  public readonly onTargetDestroy = new Observable<TargetDestroyPayload>();
  public readonly onTargetSpawn = new Observable<SpawnTargetPayload>();

  constructor(
    private readonly playerStateManager: PlayerStateManager,
    private readonly getSocketId: () => string | undefined
  ) {
    this.setupDispatcher();
  }

  public handlePlayerJoined(user: Pick<PlayerInfo, 'userId' | 'name'>): void {
    this.playerStateManager.registerPlayer({
      id: user.userId,
      name: user.name || 'Anonymous',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      weaponId: 'Pistol',
      health: 100,
    });
    this.notifyPlayersSnapshot();
  }

  public handlePlayerLeft(id: string): void {
    this.playerStateManager.removePlayer(id);
    this.notifyPlayersSnapshot();
  }

  public handleTransportEvent(event: InboundTransportEvent, isMasterClient: boolean): void {
    this.onEvent.notifyObservers({
      code: event.code,
      data: event.data,
      senderId: event.senderId,
    });

    if (isMasterClient && event.kind === 'request') {
      return;
    }

    this.dispatchRawEvent(event.code, event.data, event.senderId);
  }

  public dispatchLocalEvent(code: number, data: unknown, senderId: string): void {
    this.onEvent.notifyObservers({ code, data, senderId });
    this.dispatchRawEvent(code, data, senderId);
  }

  public clearObservers(scope: 'session' | 'all' = 'session'): void {
    this.onPlayersList.clear();
    this.onPlayerFired.clear();
    this.onPlayerReloaded.clear();
    this.onPlayerHit.clear();
    this.onPlayerDied.clear();
    this.onEnemyUpdated.clear();
    this.onEnemyHit.clear();
    this.onEnemyDestroyed.clear();
    this.onPickupDestroyed.clear();
    this.onPlayerRespawn.clear();
    this.onGameEnd.clear();
    this.onInitialStateReceived.clear();
    this.onInitialStateRequested.clear();
    this.onTargetHit.clear();
    this.onTargetDestroy.clear();
    this.onTargetSpawn.clear();
    this.onEvent.clear();

    if (scope === 'all') {
      this.dispatcher.clear();
    }
  }

  public notifyPlayersSnapshot(): void {
    this.onPlayersList.notifyObservers(this.playerStateManager.getAllPlayers());
  }

  private dispatchRawEvent(code: number, data: unknown, senderId: string): void {
    this.dispatcher.dispatch(code as EventCode, data as never, senderId);
  }

  private setupDispatcher(): void {
    this.registerPlayerCombatEvents();
    this.registerWorldEvents();
    this.registerStateEvents();
  }

  private registerPlayerCombatEvents(): void {
    this.dispatcher.register(EventCode.FIRE, (fireData, senderId): void => {
      const payload = fireData as Partial<FireEventData>;
      const playerId = typeof payload.playerId === 'string' ? payload.playerId : senderId;
      const weaponId = typeof payload.weaponId === 'string' ? payload.weaponId : 'Unknown';

      this.onPlayerFired.notifyObservers({
        playerId,
        weaponId,
        muzzleTransform: payload.muzzleTransform,
      });
    });

    this.dispatcher.register(EventCode.HIT, (data): void => {
      this.onPlayerHit.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.SYNC_WEAPON, (syncData, senderId): void => {
      this.playerStateManager.updatePlayer(senderId, { weaponId: syncData.weaponId });
    });

    this.dispatcher.register(EventCode.MOVE, (moveData, senderId): void => {
      const player = this.playerStateManager.getPlayer(senderId);
      if (!player) return;

      const isLocal = senderId === this.getSocketId();
      if (isLocal) {
        const dist = Vector3.Distance(
          new Vector3(player.position.x, player.position.y, player.position.z),
          new Vector3(moveData.position.x, moveData.position.y, moveData.position.z)
        );
        if (dist > 2.0) {
          // Reserved for reconciliation logic.
        }
        return;
      }

      this.playerStateManager.updatePlayer(senderId, {
        position: { x: moveData.position.x, y: moveData.position.y, z: moveData.position.z },
        rotation: { x: moveData.rotation.x, y: moveData.rotation.y, z: moveData.rotation.z },
      });
    });

    this.dispatcher.register(EventCode.PLAYER_DEATH, (data): void => {
      this.onPlayerDied.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.RESPAWN, (data): void => {
      this.onPlayerRespawn.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.RELOAD, (data): void => {
      this.onPlayerReloaded.notifyObservers(data);
    });
  }

  private registerWorldEvents(): void {
    this.dispatcher.register(EventCode.DESTROY_ENEMY, (data): void => {
      this.onEnemyDestroyed.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.DESTROY_PICKUP, (data): void => {
      this.onPickupDestroyed.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.ENEMY_MOVE, (data): void => {
      this.onEnemyUpdated.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.ENEMY_HIT, (data): void => {
      this.onEnemyHit.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.TARGET_HIT, (data): void => {
      this.onTargetHit.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.GAME_END, (data): void => {
      this.onGameEnd.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.TARGET_DESTROY, (data): void => {
      this.onTargetDestroy.notifyObservers(data);
    });

    this.dispatcher.register(EventCode.SPAWN_TARGET, (data): void => {
      this.onTargetSpawn.notifyObservers(data);
    });
  }

  private registerStateEvents(): void {
    this.dispatcher.register(EventCode.REQ_INITIAL_STATE, (_data, senderId): void => {
      this.onInitialStateRequested.notifyObservers({ senderId });
    });

    this.dispatcher.register(EventCode.INITIAL_STATE, (stateData): void => {
      this.onInitialStateReceived.notifyObservers({
        players: stateData.players,
        enemies: stateData.enemies,
        targets: stateData.targets,
        weaponConfigs: stateData.weaponConfigs,
      });
    });
  }
}
