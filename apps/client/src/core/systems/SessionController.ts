import { Scene, Vector3, ShadowGenerator, UniversalCamera, Observer } from '@babylonjs/core';
import { PlayerPawn } from '../PlayerPawn';
import { PlayerController } from '../controllers/PlayerController';
import { LevelData } from '@ante/game-core';
import { CombatComponent } from '../components/CombatComponent';
import { HUD } from '../../ui/HUD';
import { InventoryUI } from '../../ui/inventory/InventoryUI';
import { MultiplayerSystem } from './MultiplayerSystem';
import { PickupManager } from './PickupManager';
import { TargetSpawnerComponent } from '../components/TargetSpawnerComponent';
import { EnemyManager } from './EnemyManager';
import { InitialStatePayload, SpawnTargetPayload, RespawnEventData } from '@ante/common';
import { WorldSimulation, WaveSurvivalRule, TickManager } from '@ante/game-core';
import { WorldEntityManager } from './WorldEntityManager';
import { GameObservables } from '../events/GameObservables';
import { GameAssets } from '../GameAssets';
import { playerHealthStore } from '../store/GameStore';
import { INetworkManager } from '../interfaces/INetworkManager';
import { IUIManager } from '../../ui/IUIManager';
import { LocalServerManager } from '../server/LocalServerManager';
import { GlobalInputManager } from './GlobalInputManager';
import { CameraComponent } from '../components/CameraComponent';
import { SpectatorManager } from './session/SpectatorManager';
import { InventorySyncService } from './session/InventorySyncService';
import type { GameContext } from '../../types/GameContext';

/**
 * 네트워크 에러 헨들러 타입
 */
export type ErrorHandler = (error: Error, context: string) => void;

/**
 * SessionControllerOptions
 * 의존성 주입을 위한 옵션 인터페이스
 */
export interface SessionControllerOptions {
  networkManager: INetworkManager;
  uiManager: IUIManager;
  worldManager: WorldEntityManager;
  enemyManager: EnemyManager;
  pickupManager: PickupManager;
  tickManager: TickManager;
  localServerManager: LocalServerManager;
  onError?: ErrorHandler;
  debug?: boolean;
}

export class SessionController {
  private scene: Scene;
  private canvas: HTMLCanvasElement;
  private shadowGenerator: ShadowGenerator;

  private playerPawn: PlayerPawn | null = null;
  private playerController: PlayerController | null = null;
  private multiplayerSystem: MultiplayerSystem | null = null;
  private hud: HUD | null = null;
  private inventoryUI: InventoryUI | null = null;
  private enemyManager: EnemyManager | null = null;
  private targetSpawner: TargetSpawnerComponent | null = null;
  private simulation: WorldSimulation | null = null;
  private healthUnsub: (() => void) | null = null;
  private _initialStateObserver: Observer<InitialStatePayload> | null = null;
  private _itemCollectionObserver: Observer<{ itemId: string; position: Vector3 }> | null = null;
  private _playerRespawnObserver: Observer<RespawnEventData> | null = null;

  private networkManager: INetworkManager;
  private uiManager: IUIManager;
  private worldManager: WorldEntityManager;
  private pickupManager: PickupManager;
  private inputManager: GlobalInputManager;
  private spectatorManager: SpectatorManager;
  private inventorySyncService: InventorySyncService;
  private tickManager: TickManager;
  private localServerManager: LocalServerManager;
  private ctx!: GameContext;

  constructor(
    scene: Scene,
    canvas: HTMLCanvasElement,
    shadowGenerator: ShadowGenerator,
    options: SessionControllerOptions
  ) {
    this.scene = scene;
    this.canvas = canvas;
    this.shadowGenerator = shadowGenerator;
    this.networkManager = options.networkManager;
    this.uiManager = options.uiManager;
    this.worldManager = options.worldManager;
    this.enemyManager = options.enemyManager;
    this.pickupManager = options.pickupManager;
    this.tickManager = options.tickManager;
    this.localServerManager = options.localServerManager;
    this.inputManager = new GlobalInputManager(this.uiManager);
    this.spectatorManager = new SpectatorManager({
      getMultiplayerSystem: (): MultiplayerSystem | null => this.multiplayerSystem,
      getPlayerPawn: (): PlayerPawn | null => this.playerPawn,
      getPlayerController: (): PlayerController | null => this.playerController,
      getHud: (): HUD | null => this.hud,
    });
    this.inventorySyncService = new InventorySyncService({
      getPlayerPawn: (): PlayerPawn | null => this.playerPawn,
    });
  }

  public async initialize(levelData: LevelData, playerName: string = 'Anonymous'): Promise<void> {
    this.ctx = {
      scene: this.scene,
      camera: null as unknown as UniversalCamera,
      tickManager: this.tickManager,
      networkManager: this.networkManager,
      worldManager: this.worldManager,
    } as GameContext;

    this.playerPawn = new PlayerPawn(this.ctx);

    const camComp = this.playerPawn.getComponent(CameraComponent) as CameraComponent;
    if (camComp) {
      this.ctx.camera = camComp.camera;
    }

    this.worldManager.initialize();
    this.worldManager.register(this.playerPawn);

    if (levelData.playerSpawn) {
      this.playerPawn.position = Vector3.FromArray(levelData.playerSpawn);
    } else {
      this.playerPawn.position = new Vector3(0, 1.75, -5);
    }

    this.playerController = new PlayerController('player1', this.canvas, this.tickManager);
    this.playerController.possess(this.playerPawn);

    this.hud = new HUD(this.uiManager);

    this.setupSystems(levelData);
    this.setupCombat();
    this.setupInventory();
    this.setupInput();

    this.setupMultiplayer(playerName);
    this.spectatorManager.initializeInput();
  }

  private setupSystems(levelData: LevelData): void {
    this.targetSpawner = new TargetSpawnerComponent(this.ctx, this.shadowGenerator);
    if (levelData.enemySpawns && levelData.enemySpawns.length > 0) {
      // Logic for enemy spawns
    }
    this.pickupManager.initialize(this.scene, this.playerPawn!);
    this._itemCollectionObserver = GameObservables.itemCollection.add((): void => {
      GameAssets.sounds.swipe?.play();
    });
  }

  private setupCombat(): void {
    const combatComp = new CombatComponent(this.playerPawn!, this.scene, this.ctx);
    this.playerPawn!.addComponent(combatComp);

    this.healthUnsub = playerHealthStore.subscribe((health: number): void => {
      this.spectatorManager.onHealthChanged(health);
    });

    combatComp.onWeaponChanged((newWeapon: { name: string }): void => {
      this.inventorySyncService.syncStoreFromCombat();
      if (this.multiplayerSystem) {
        this.networkManager.syncWeapon(newWeapon.name);
      }
    });
  }

  private setupInventory(): void {
    this.inventoryUI = new InventoryUI(this.inventorySyncService.createCallbacks(), this.uiManager);
    this.inventorySyncService.syncStoreFromCombat();
  }

  public start(): void {
    if (!this.playerPawn) return;
    this.playerPawn.initialize();
    this.inventorySyncService.syncStoreFromCombat();
  }

  private setupInput(): void {
    this.inputManager.initialize(
      this.scene,
      this.canvas,
      this.playerPawn!,
      this.playerController!,
      this.inventoryUI!
    );
  }

  private setupMultiplayer(playerName: string): void {
    this.multiplayerSystem = new MultiplayerSystem(
      this.scene,
      this.playerPawn!,
      this.shadowGenerator,
      this.networkManager,
      this.worldManager,
      this.tickManager,
      playerName
    );

    const isLocalServerRunning = this.localServerManager.isServerRunning();
    if (this.enemyManager && this.targetSpawner && !isLocalServerRunning) {
      this.simulation = new WorldSimulation(
        this.enemyManager,
        this.pickupManager,
        this.targetSpawner,
        this.networkManager
      );
      this.simulation.setGameRule(new WaveSurvivalRule());
    }

    this._initialStateObserver = this.networkManager.onInitialStateReceived.add(
      (data: InitialStatePayload): void => {
        if (this.enemyManager) {
          this.enemyManager.applyEnemyStates(data.enemies);
        }
        if (this.multiplayerSystem) {
          this.multiplayerSystem.applyPlayerStates(data.players);
        }
        if (data.targets && this.targetSpawner) {
          data.targets.forEach((t: SpawnTargetPayload): void => {
            this.targetSpawner!.spawnTarget(
              new Vector3(t.position.x, t.position.y, t.position.z),
              t.isMoving,
              t.id,
              t.type
            );
          });
        }
      }
    );

    this._playerRespawnObserver = this.networkManager.onPlayerRespawn.add((data) => {
      if (data.playerId === this.networkManager.getSocketId()) {
        this.spectatorManager.onLocalRespawn(data.position);
      }
    });
  }

  public getPlayerCamera(): UniversalCamera | null {
    return this.playerPawn?.camera || null;
  }

  public setInputBlocked(blocked: boolean): void {
    this.playerController?.setInputBlocked(blocked);
  }

  public update(deltaTime: number): void {
    if (this.multiplayerSystem) {
      this.multiplayerSystem.update();
    }
    if (this.enemyManager) {
      this.enemyManager.update(deltaTime);
    }
    this.spectatorManager.update();
  }

  public dispose(): void {
    this.healthUnsub?.();
    this.spectatorManager.dispose();
    this.inputManager.dispose();
    this.playerController?.dispose();
    this.playerPawn?.dispose();
    this.hud?.dispose();
    this.inventoryUI?.dispose();
    this.multiplayerSystem?.dispose();
    this.enemyManager?.dispose();
    if (this._initialStateObserver) {
      this.networkManager.onInitialStateReceived.remove(this._initialStateObserver);
      this._initialStateObserver = null;
    }
    if (this._itemCollectionObserver) {
      GameObservables.itemCollection.remove(this._itemCollectionObserver);
      this._itemCollectionObserver = null;
    }
    if (this._playerRespawnObserver) {
      this.networkManager.onPlayerRespawn.remove(this._playerRespawnObserver);
      this._playerRespawnObserver = null;
    }
  }
}
