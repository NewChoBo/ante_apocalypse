import { Engine, Vector3, UniversalCamera } from '@babylonjs/core';
import { gameStateStore } from './store/GameStore';
import { GameObservables } from './events/GameObservables';
import { LevelLoader, LevelData } from './systems/LevelLoader';
import { TickManager } from './TickManager';
import { AssetLoader } from './AssetLoader';
import { WorldEntityManager } from './systems/WorldEntityManager';
import { PickupManager } from './systems/PickupManager';
import { UIManager, UIScreen } from '../ui/UIManager';
import { SceneManager } from './systems/SceneManager';
import { SessionController } from './systems/SessionController';
import { GameMode } from '../types/GameMode';
import { NetworkManager } from './systems/NetworkManager';
import { NetworkState } from '@ante/common';

import trainingGroundData from '../assets/levels/training_ground.json';
import combatZoneData from '../assets/levels/combat_zone.json';

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

  private isRunning = false;
  private currentMode: GameMode = 'multi';
  private playerName: string = 'Anonymous';
  private renderFunction: () => void;

  constructor() {
    this.renderFunction = () => {
      const scene = this.sceneManager.getScene();
      if (scene) {
        if (scene.activeCamera) {
          const deltaTime = this.engine.getDeltaTime() / 1000;
          this.update(deltaTime);
        }
        scene.render();
      }
    };

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
    const { scene, shadowGenerator } = await this.sceneManager.createMenuScene();
    this.uiManager = UIManager.initialize(scene);

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
    // Clear old observers if any (UIManager.initialize already disposes old instance)
    this.uiManager.onLogin.add((name) => {
      this.playerName = name;
      this.uiManager.showScreen(UIScreen.MAIN_MENU);
    });

    this.uiManager.onStartMultiplayer.add(() => {
      // Start connection to Network (Photon)
      NetworkManager.getInstance().connect(this.playerName);
      this.uiManager.showScreen(UIScreen.LOBBY);
    });

    // Listen for room join
    NetworkManager.getInstance().onStateChanged.removeCallback((state) =>
      this.handleNetworkStateChange(state)
    );
    NetworkManager.getInstance().onStateChanged.add((state) =>
      this.handleNetworkStateChange(state)
    );

    this.uiManager.onAbort.add(() => this.quitToMenu());

    this.uiManager.onResume.add(() => {
      this.uiManager.showScreen(UIScreen.NONE);
      if (this.sessionController) {
        this.sessionController.setInputBlocked(false);
      }
    });

    this.uiManager.onLogout.add(() => {
      NetworkManager.getInstance().leaveRoom();
      this.uiManager.showScreen(UIScreen.LOGIN);
    });
  }

  private handleNetworkStateChange(state: NetworkState): void {
    if (state === NetworkState.InRoom && !this.isRunning) {
      console.log('[Game] Joined room, starting multiplayer game...');
      this.start();
    } else if (state === NetworkState.Error || state === NetworkState.Disconnected) {
      if (this.isRunning) {
        console.warn(`[Game] Network failure detected (State: ${state}). Returning to menu.`);
        this.quitToMenu();
        this.uiManager.showNotification('COMMUNICATION_LINK_LOST:_REVERTING_TO_STAGING');
      }
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.currentMode = 'multi';

    // Use map selected from UI (or synchronized from room)
    let mapKey = this.uiManager.getSelectedMap();
    const syncedMap = NetworkManager.getInstance().getMapId();
    if (syncedMap) {
      mapKey = syncedMap;
      console.log(`[Game] Using synchronized map: ${mapKey}`);
    }
    const levelData = LEVELS[mapKey] || LEVELS['training_ground'];

    this.engine.stopRenderLoop(this.renderFunction);
    this.engine.displayLoadingUI();

    const { scene, shadowGenerator } = await this.sceneManager.createGameScene();
    this.uiManager = UIManager.initialize(scene);
    this.setupUIManagerEvents();

    const levelLoader = new LevelLoader(scene, shadowGenerator);
    await levelLoader.loadLevelData(levelData);

    try {
      await AssetLoader.getInstance().load(scene);
    } catch (e) {
      console.error('Failed to preload assets:', e);
    }

    this.sessionController = new SessionController(scene, this.canvas, shadowGenerator);
    await this.sessionController.initialize(levelData, this.playerName);

    // Ensure the player camera is active
    if (this.sessionController.getPlayerCamera()) {
      scene.activeCamera = this.sessionController.getPlayerCamera();
    }

    // Listen for player death to trigger Game Over
    GameObservables.playerDied.add(() => {
      if (this.isRunning) this.gameOver();
    });

    this.engine.hideLoadingUI();
    this.isRunning = true;
    gameStateStore.set('PLAYING');

    this.uiManager.showScreen(UIScreen.NONE);
    // requestPointerLock is already called inside showScreen(UIScreen.NONE)

    // Unlock audio
    AssetLoader.getInstance().getAudioEngine()?.resumeAsync();

    this.engine.runRenderLoop(this.renderFunction);
  }

  public gameOver(): void {
    this.isRunning = false;
    gameStateStore.set('GAME_OVER');
    // this.uiManager.setGameOverUI(true); // Removed
    this.uiManager.showScreen(UIScreen.MAIN_MENU);
    this.uiManager.exitPointerLock();
  }

  public quitToMenu(): void {
    this.isRunning = false;

    this.uiManager.showScreen(UIScreen.NONE); // Cleanup current
    this.uiManager.exitPointerLock();

    this.engine.stopRenderLoop(this.renderFunction);
    this.sessionController?.dispose();
    this.sessionController = null;

    // Reset Managers
    TickManager.getInstance().clear();
    WorldEntityManager.getInstance().clear();
    PickupManager.getInstance().clear();
    AssetLoader.getInstance().clear();

    if (this.currentMode === 'multi') {
      NetworkManager.getInstance().leaveRoom();
    }

    this.initMenu();
  }

  private update(deltaTime: number): void {
    TickManager.getInstance().tick(deltaTime);
    this.sessionController?.update(deltaTime);
  }
}
