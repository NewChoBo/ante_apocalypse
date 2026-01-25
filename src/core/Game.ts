import { Engine, Vector3, UniversalCamera } from '@babylonjs/core';
import { gameStateStore } from './store/GameStore';
import { GameObservables } from './events/GameObservables';
import { LevelLoader, LevelData } from './systems/LevelLoader';
import { TickManager } from './TickManager';
import { AssetLoader } from './AssetLoader';
import { TargetRegistry } from './systems/TargetRegistry';
import { PickupManager } from './systems/PickupManager';
import { UIManager, UIScreen } from '../ui/UIManager';
import { SceneManager } from './systems/SceneManager';
import { SessionController } from './systems/SessionController';
import { GameMode } from '../types/GameMode';

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
  private isPaused = false;
  private currentMode: GameMode = 'single';
  private playerName: string = 'Anonymous';
  private renderFunction: () => void;

  constructor() {
    this.renderFunction = () => {
      const scene = this.sceneManager.getScene();
      if (scene) {
        if (scene.activeCamera) {
          const deltaTime = this.engine.getDeltaTime() / 1000;

          // Only stop the world tick if in singleplayer mode
          const shouldTick = !this.isPaused || this.currentMode !== 'single';
          if (shouldTick) {
            this.update(deltaTime);
          }
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
      console.log(`Player logging in as: ${this.playerName}`);
      this.uiManager.showScreen(UIScreen.MAIN_MENU);
    });

    this.uiManager.onStartSingleplayer.add(() => {
      this.start('single');
    });

    this.uiManager.onStartMultiplayer.add(() => {
      this.uiManager.showScreen(UIScreen.LOBBY);
    });

    this.uiManager.onResume.add(() => this.resume());
    this.uiManager.onAbort.add(() => this.quitToMenu());
  }

  public async start(mode: GameMode = 'single'): Promise<void> {
    if (this.isRunning) return;
    this.currentMode = mode;

    // Use map selected from UI
    const mapKey = this.uiManager.getSelectedMap();
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
    await this.sessionController.initialize(levelData, mode, this.playerName);

    // Ensure the player camera is active
    if (this.sessionController.getPlayerCamera()) {
      scene.activeCamera = this.sessionController.getPlayerCamera();
    }

    // Listen for player death to trigger Game Over
    GameObservables.playerDied.add(() => {
      if (this.isRunning && !this.isPaused) this.gameOver();
    });

    this.engine.hideLoadingUI();
    this.isRunning = true;
    this.isPaused = false;
    gameStateStore.set('PLAYING');

    this.uiManager.showScreen(UIScreen.NONE);
    // requestPointerLock is already called inside showScreen(UIScreen.NONE)

    // Unlock audio
    AssetLoader.getInstance().getAudioEngine()?.resumeAsync();

    this.engine.runRenderLoop(this.renderFunction);
  }

  private gameOver(): void {
    this.isPaused = true;
    gameStateStore.set('GAME_OVER');
    this.uiManager.setGameOverUI(true);
    this.uiManager.showScreen(UIScreen.PAUSE);
    this.uiManager.exitPointerLock();
  }

  public pause(): void {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    gameStateStore.set('PAUSED');
    this.uiManager.setGameOverUI(false);
    this.uiManager.showScreen(UIScreen.PAUSE);
    this.uiManager.exitPointerLock();
    this.sessionController?.setInputBlocked(true);
  }

  public resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    gameStateStore.set('PLAYING');
    this.uiManager.showScreen(UIScreen.NONE);
    this.sessionController?.setInputBlocked(false);
  }

  public togglePause(): void {
    if (!this.isRunning) return;
    this.isPaused ? this.resume() : this.pause();
  }

  public quitToMenu(): void {
    this.isPaused = false;
    this.isRunning = false;

    this.uiManager.showScreen(UIScreen.NONE); // Cleanup current
    this.uiManager.exitPointerLock();

    this.engine.stopRenderLoop(this.renderFunction);
    this.sessionController?.dispose();
    this.sessionController = null;

    // Reset Managers
    TickManager.getInstance().clear();
    TargetRegistry.getInstance().clear();
    PickupManager.getInstance().clear();
    AssetLoader.getInstance().clear();

    this.initMenu();
  }

  private update(deltaTime: number): void {
    TickManager.getInstance().tick(deltaTime);
    this.sessionController?.update();
  }
}
