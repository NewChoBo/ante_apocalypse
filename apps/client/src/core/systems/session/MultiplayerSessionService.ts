import { Observer, Scene, ShadowGenerator, Vector3 } from '@babylonjs/core';
import { InitialStatePayload, RespawnEventData } from '@ante/common';
import { BaseTargetSpawner, TickManager, WaveSurvivalRule, WorldSimulation } from '@ante/game-core';
import type { PlayerPawn } from '../../PlayerPawn';
import { INetworkManager } from '../../interfaces/INetworkManager';
import type { MultiplayerSystem } from '../MultiplayerSystem';
import { WorldEntityManager } from '../WorldEntityManager';
import { EnemyManager } from '../EnemyManager';
import { PickupManager } from '../PickupManager';
import { LocalServerManager } from '../../server/LocalServerManager';
import { isSamePlayerId } from '../../network/identity';

class DisabledTargetSpawner extends BaseTargetSpawner {
  public override spawnInitialTargets(): void {}

  public override broadcastTargetSpawn(
    _id: string,
    _type: string,
    _position: Vector3,
    _isMoving: boolean
  ): void {}

  public override broadcastTargetDestroy(_targetId: string): void {}

  public override getRandomTargetPosition(): { position: Vector3; isMoving: boolean } {
    return {
      position: Vector3.Zero(),
      isMoving: false,
    };
  }

  public override spawnTargetAt(
    _id: string,
    _type: string,
    _position: Vector3,
    _isMoving: boolean
  ): void {}
}

interface MultiplayerSessionServiceDeps {
  scene: Scene;
  shadowGenerator: ShadowGenerator;
  networkManager: INetworkManager;
  worldManager: WorldEntityManager;
  tickManager: TickManager;
  pickupManager: PickupManager;
  localServerManager: LocalServerManager;
  getEnemyManager: () => EnemyManager | null;
  onLocalRespawn: (position?: { x: number; y: number; z: number }) => void;
  createMultiplayerSystem: (playerPawn: PlayerPawn, playerName: string) => MultiplayerSystem;
  createSimulation?: (enemyManager: EnemyManager) => WorldSimulation;
}

export class MultiplayerSessionService {
  private multiplayerSystem: MultiplayerSystem | null = null;
  private simulation: WorldSimulation | null = null;
  private initialStateObserver: Observer<InitialStatePayload> | null = null;
  private playerRespawnObserver: Observer<RespawnEventData> | null = null;

  constructor(private readonly deps: MultiplayerSessionServiceDeps) {}

  public initialize(playerPawn: PlayerPawn, playerName: string): MultiplayerSystem {
    this.multiplayerSystem = this.deps.createMultiplayerSystem(playerPawn, playerName);
    this.multiplayerSystem.setLocalRespawnHandler((position: Vector3): void => {
      this.deps.onLocalRespawn({ x: position.x, y: position.y, z: position.z });
    });

    this.setupSimulation();
    this.bindObservers();

    return this.multiplayerSystem;
  }

  public getMultiplayerSystem(): MultiplayerSystem | null {
    return this.multiplayerSystem;
  }

  public getSimulation(): WorldSimulation | null {
    return this.simulation;
  }

  public update(): void {
    this.multiplayerSystem?.update();
  }

  public dispose(): void {
    if (this.initialStateObserver) {
      this.deps.networkManager.onInitialStateReceived.remove(this.initialStateObserver);
      this.initialStateObserver = null;
    }
    if (this.playerRespawnObserver) {
      this.deps.networkManager.onPlayerRespawn.remove(this.playerRespawnObserver);
      this.playerRespawnObserver = null;
    }
    this.multiplayerSystem?.dispose();
    this.multiplayerSystem = null;
    this.simulation = null;
  }

  private setupSimulation(): void {
    const enemyManager = this.deps.getEnemyManager();
    if (!enemyManager || this.deps.localServerManager.isServerRunning()) {
      this.simulation = null;
      return;
    }

    const createSimulation =
      this.deps.createSimulation ??
      ((enemy: EnemyManager): WorldSimulation => {
        const simulation = new WorldSimulation(
          enemy,
          this.deps.pickupManager,
          new DisabledTargetSpawner(this.deps.networkManager),
          this.deps.networkManager
        );
        simulation.setGameRule(new WaveSurvivalRule());
        return simulation;
      });
    this.simulation = createSimulation(enemyManager);
  }

  private bindObservers(): void {
    this.initialStateObserver = this.deps.networkManager.onInitialStateReceived.add(
      (data: InitialStatePayload): void => {
        this.deps.getEnemyManager()?.applyEnemyStates(data.enemies);
        this.multiplayerSystem?.applyPlayerStates(data.players);
      }
    );

    this.playerRespawnObserver = this.deps.networkManager.onPlayerRespawn.add(
      (data: RespawnEventData): void => {
        if (isSamePlayerId(data.playerId, this.deps.networkManager.getSocketId())) {
          this.deps.onLocalRespawn(data.position);
        }
      }
    );
  }
}

