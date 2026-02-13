import { Observer, Scene, ShadowGenerator, Vector3 } from '@babylonjs/core';
import { InitialStatePayload, RespawnEventData, SpawnTargetPayload } from '@ante/common';
import { TickManager, WaveSurvivalRule, WorldSimulation } from '@ante/game-core';
import type { PlayerPawn } from '../../PlayerPawn';
import { INetworkManager } from '../../interfaces/INetworkManager';
import type { MultiplayerSystem } from '../MultiplayerSystem';
import { WorldEntityManager } from '../WorldEntityManager';
import { EnemyManager } from '../EnemyManager';
import { PickupManager } from '../PickupManager';
import { TargetSpawnerComponent } from '../../components/target/TargetSpawnerComponent';
import { LocalServerManager } from '../../server/LocalServerManager';
import { isSamePlayerId } from '../../network/identity';

interface MultiplayerSessionServiceDeps {
  scene: Scene;
  shadowGenerator: ShadowGenerator;
  networkManager: INetworkManager;
  worldManager: WorldEntityManager;
  tickManager: TickManager;
  pickupManager: PickupManager;
  localServerManager: LocalServerManager;
  getEnemyManager: () => EnemyManager | null;
  getTargetSpawner: () => TargetSpawnerComponent | null;
  onLocalRespawn: (position?: { x: number; y: number; z: number }) => void;
  createMultiplayerSystem: (playerPawn: PlayerPawn, playerName: string) => MultiplayerSystem;
  createSimulation?: (
    enemyManager: EnemyManager,
    targetSpawner: TargetSpawnerComponent
  ) => WorldSimulation;
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
    const targetSpawner = this.deps.getTargetSpawner();
    if (!enemyManager || !targetSpawner || this.deps.localServerManager.isServerRunning()) {
      this.simulation = null;
      return;
    }

    const createSimulation =
      this.deps.createSimulation ??
      ((enemy: EnemyManager, target: TargetSpawnerComponent): WorldSimulation => {
        const simulation = new WorldSimulation(
          enemy,
          this.deps.pickupManager,
          target,
          this.deps.networkManager
        );
        simulation.setGameRule(new WaveSurvivalRule());
        return simulation;
      });
    this.simulation = createSimulation(enemyManager, targetSpawner);
  }

  private bindObservers(): void {
    this.initialStateObserver = this.deps.networkManager.onInitialStateReceived.add(
      (data: InitialStatePayload): void => {
        this.deps.getEnemyManager()?.applyEnemyStates(data.enemies);
        this.multiplayerSystem?.applyPlayerStates(data.players);

        const targetSpawner = this.deps.getTargetSpawner();
        if (targetSpawner && data.targets) {
          data.targets.forEach((target: SpawnTargetPayload): void => {
            targetSpawner.spawnTarget(
              new Vector3(target.position.x, target.position.y, target.position.z),
              target.isMoving,
              target.id,
              target.type
            );
          });
        }
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

