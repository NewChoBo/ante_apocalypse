import { Engine, Vector3, UniversalCamera, Observer } from '@babylonjs/core';
import { gameStateStore } from './store/GameStore';
import { GameObservables } from './events/GameObservables';
import { LevelLoader } from './systems/LevelLoader';
import { LevelData, TickManager as CoreTickManager } from '@ante/game-core';
import { GameAssets } from './GameAssets';
import { WorldEntityManager } from './systems/WorldEntityManager';
import { PickupManager } from './systems/PickupManager';
import { UIManager, UIScreen } from '../ui/UIManager';
import { SceneManager } from './systems/SceneManager';
import { SessionController } from './systems/SessionController';
import { NetworkState, Logger } from '@ante/common';
import { EnemyManager } from './systems/EnemyManager'; // Added import
import { LocalServerManager } from './server/LocalServerManager';
import { PhotonProvider } from './network/providers/PhotonProvider';
import { GameNetworkCoordinator } from './systems/GameNetworkCoordinator';

const logger = new Logger('Game');
import { NetworkManager } from './systems/NetworkManager';

import trainingGroundData from '@ante/assets/levels/training_ground.json';
import combatZoneData from '@ante/assets/levels/combat_zone.json';

const LEVELS: Record<string, LevelData> = {
  training_ground: trainingGroundData as LevelData,
  combat_zone: combatZoneData as LevelData,
};

export class Game {
  private canvas!: HTMLCanvasElement;
  private engine!: Engine;
  private sceneManager!: SceneManager;
  private sessionController: SessionController | null = null;
  private uiManager!: UIManager;
  private tickManager: CoreTickManager;
  private networkManager: NetworkManager;
  private networkCoordinator: GameNetworkCoordinator;
  private localServerManager: LocalServerManager;

  private isRunning = false;
  private isLoading = false;
  private playerName: string = 'Anonymous';
  private renderFunction: () => void;
  private _playerDiedObserver: Observer<null> | null = null;

  constructor() {
    this.renderFunction = (): void => {
      const scene = this.sceneManager.getScene();
      if (scene) {
        if (scene.activeCamera) {
          const deltaTime = this.engine.getDeltaTime() / 1000;
          this.update(deltaTime);
        }
        scene.render();
      }
    };

    // Input handling delegated to GlobalInputManager (in-game) and UIManager (menu)

    this.tickManager = new CoreTickManager();
    this.localServerManager = new LocalServerManager();
    this.networkManager = new NetworkManager(this.localServerManager, new PhotonProvider());
    this.networkCoordinator = new GameNetworkCoordinator({
      networkManager: this.networkManager,
      onNetworkStateChanged: (state: NetworkState): void => this.handleNetworkStateChange(state),
      onGameEnd: (data): void => {
        logger.info(`Game End received: ${data.reason}`);
        this.gameOver(data.reason);
      },
    });

    this.initCanvas();
    this.initEngine();
    this.sceneManager = new SceneManager(this.engine);
    this.initMenu();
  }

  private initCanvas(): void {
    const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
    if (!canvas) throw new Error("Canvas 'renderCanvas' not found in document");
    this.canvas = canvas;
  }

  private initEngine(): void {
    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });

    window.addEventListener('resize', () => this.engine.resize());
  }

  private async initMenu(): Promise<void> {
    this.uiManager?.dispose();
    const { scene, shadowGenerator } = await this.sceneManager.createMenuScene();
    this.uiManager = new UIManager(scene, this.networkManager);

    const levelLoader = new LevelLoader(scene, shadowGenerator);
    await levelLoader.loadLevelData(LEVELS['training_ground']);

    const menuCamera = new UniversalCamera('menuCamera', new Vector3(0, 2, -10), scene);
    menuCamera.setTarget(Vector3.Zero());
    scene.activeCamera = menuCamera;
    // Menu camera doesn't need control anymore if we use Babylon GUI exclusively
    // menuCamera.attachControl(this.canvas, true);

    this.setupUIManagerEvents();
    this.uiManager.showScreen(UIScreen.LOGIN);

    if (!this.isRunning) {
      this.engine.runRenderLoop(this.renderFunction);
    }
  }

  private setupUIManagerEvents(): void {
    // Clear existing observers (UIManager.initialize already disposes old instance)
    this.uiManager.onLogin.add((name) => {
      this.playerName = name;
      this.uiManager.showScreen(UIScreen.MAIN_MENU);
    });

    this.uiManager.onStartMultiplayer.add(() => {
      // Start connection to Network (Photon)
      this.networkManager.connect(this.playerName);
      this.uiManager.showScreen(UIScreen.LOBBY);
    });

    logger.info('Binding Game network observers...');
    this.networkCoordinator.bind();

    this.uiManager.onAbort.add(() => this.quitToMenu());

    this.uiManager.onResume.add(() => {
      this.uiManager.showScreen(UIScreen.NONE);
      if (this.sessionController) {
        this.sessionController.setInputBlocked(false);
      }
    });

    this.uiManager.onLogout.add(() => {
      this.networkManager.leaveRoom();
      this.uiManager.showScreen(UIScreen.LOGIN);
    });

  }

  private handleNetworkStateChange(state: NetworkState): void {
    logger.info(`Game received network state: ${state} (isRunning: ${this.isRunning})`);
    if (state === NetworkState.InRoom && !this.isRunning) {
      logger.info('Joined room, starting multiplayer game...');
      this.start();
    } else if (state === NetworkState.Error || state === NetworkState.Disconnected) {
      if (this.isRunning) {
        logger.warn(`Network failure detected (State: ${state}). Returning to menu.`);
        this.quitToMenu();
        this.uiManager.showNotification('COMMUNICATION_LINK_LOST:_REVERTING_TO_STAGING');
      }
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning || this.isLoading) return;

    this.isLoading = true;

    // Use map selected from UI (or synchronized from room)
    let mapKey = this.uiManager.getSelectedMap();
    const syncedMap = this.networkManager.getMapId();
    if (syncedMap) {
      mapKey = syncedMap;
      logger.info(`Using synchronized map: ${mapKey}`);
    }
    const levelData = LEVELS[mapKey] || LEVELS['training_ground'];

    this.engine.stopRenderLoop(this.renderFunction);
    this.engine.displayLoadingUI();

    try {
      this.uiManager?.dispose();
      const { scene, shadowGenerator } = await this.sceneManager.createGameScene();
      this.uiManager = new UIManager(scene, this.networkManager);
      this.setupUIManagerEvents();

      const levelLoader = new LevelLoader(scene, shadowGenerator);
      await levelLoader.loadLevelData(levelData);

      // Initialize GameAssets (Audio engines, preload model containers)
      await GameAssets.initialize(scene);

      const worldManager = new WorldEntityManager(this.networkManager, this.tickManager);
      const enemyManager = new EnemyManager(
        scene,
        shadowGenerator,
        this.networkManager,
        worldManager,
        this.tickManager
      );
      const pickupManager = new PickupManager(this.networkManager, this.tickManager);

      this.sessionController = new SessionController(scene, this.canvas, shadowGenerator, {
        networkManager: this.networkManager,
        uiManager: this.uiManager,
        worldManager,
        enemyManager,
        pickupManager,
        tickManager: this.tickManager,
        localServerManager: this.localServerManager,
      });
      await this.sessionController.initialize(levelData, this.playerName);

      // Ensure the player camera is active
      if (this.sessionController.getPlayerCamera()) {
        scene.activeCamera = this.sessionController.getPlayerCamera();
      }

      // Listen for player death to trigger Game Over
      if (this._playerDiedObserver) {
        GameObservables.playerDied.remove(this._playerDiedObserver);
      }
      this._playerDiedObserver = GameObservables.playerDied.add(() => {
        if (this.isRunning) {
          // Just set state, don't show menu. Respawn logic is handled in MultiplayerSystem.
          gameStateStore.set('DEAD');
          logger.info('Local player died. Waiting for respawn or game end...');
        }
      });

      this.engine.hideLoadingUI();
      this.isRunning = true;
      gameStateStore.set('PLAYING');

      this.uiManager.showScreen(UIScreen.NONE);
      // requestPointerLock is already called inside showScreen(UIScreen.NONE)

      // Unlock audio
      GameAssets.resumeAudio();

      this.engine.runRenderLoop(this.renderFunction);
    } catch (e) {
      // Check if scene was disposed during loading (e.g. user quit)
      const scene = this.sceneManager.getScene();
      if (!scene || scene.isDisposed || (e as Error).message.includes('Scene disposed')) {
        logger.warn('Scene disposed or error during game start/loading. Aborting.');
        return;
      }

      logger.error('CRITICAL: Failed to start game.', e);
      this.uiManager.showNotification('SYSTEM_FAILURE:_STARTUP_ABORTED');
      this.quitToMenu();
    } finally {
      this.isLoading = false;
    }
  }

  public gameOver(reason: string = 'SESSION_TERMINATED'): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    gameStateStore.set('GAME_OVER');

    this.uiManager.showNotification(`MISSION_COMPLETE: ${reason}`);
    this.uiManager.showScreen(UIScreen.MAIN_MENU);
    this.uiManager.exitPointerLock();
  }

  public quitToMenu(): void {
    this.isRunning = false;

    this.networkManager.leaveGame();

    this.uiManager.showScreen(UIScreen.NONE); // Cleanup current
    this.uiManager.exitPointerLock();

    this.engine.stopRenderLoop(this.renderFunction);
    this.sessionController?.dispose();
    this.sessionController = null;

    // Reset Managers
    this.tickManager.clear();
    GameAssets.clear();

    if (this._playerDiedObserver) {
      GameObservables.playerDied.remove(this._playerDiedObserver);
      this._playerDiedObserver = null;
    }

    this.networkCoordinator.dispose();
    logger.info('Removed Game network observers');

    this.initMenu();
  }

  private update(deltaTime: number): void {
    this.tickManager.tick(deltaTime);
    this.sessionController?.update(deltaTime);
  }
}
