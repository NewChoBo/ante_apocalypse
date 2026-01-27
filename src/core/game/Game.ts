import { Engine, Vector3, UniversalCamera } from '@babylonjs/core';
import { gameStateStore } from '../store/GameStore';
import { GameObservables } from '../events/GameObservables';
import { LevelLoader, LevelData } from '../loaders/LevelLoader';
import { TickManager } from '../managers/TickManager';
import { AssetLoader } from '../loaders/AssetLoader';
import { WorldEntityManager } from '../entities/WorldEntityManager';
import { PickupManager } from '../entities/PickupManager';
import { UIManager, UIScreen } from '../../ui/UIManager';
import { SceneManager } from './SceneManager';
import { SessionController } from './SessionController';
import { GameMode } from '../../types/GameMode';
import { NetworkManager } from '../network/NetworkManager';
import { NetworkState } from '../network/NetworkProtocol';
import { LifetimeManager } from './LifetimeManager';
import { IGameRule } from '../rules/IGameRule';
import { TimeAttackRule } from '../rules/TimeAttackRule';
import { SurvivalRule } from '../rules/SurvivalRule';
import { PlayerPawn } from '../pawns/PlayerPawn';

import levelsConfig from '@/assets/data/levels.json';
import trainingGroundData from '@/assets/levels/training_ground.json';
import combatZoneData from '@/assets/levels/combat_zone.json';

const LEVEL_DATA_MAP: Record<string, any> = {
  '@/assets/levels/training_ground.json': trainingGroundData,
  '@/assets/levels/combat_zone.json': combatZoneData,
};

const LEVELS: Record<string, LevelData> = Object.entries(levelsConfig).reduce(
  (acc, [key, path]) => {
    acc[key] = LEVEL_DATA_MAP[path as string] as LevelData;
    return acc;
  },
  {} as Record<string, LevelData>
);

export class Game {
  private canvas!: HTMLCanvasElement;
  private engine!: Engine;
  private sceneManager!: SceneManager;
  private sessionController: SessionController | null = null;
  public uiManager!: UIManager;
  private currentRule!: IGameRule;

  private isRunning = false;
  private isPaused = false;
  private currentMode: GameMode = 'single';
  private playerName: string = 'Anonymous';
  private renderFunction: () => void;

  constructor() {
    this.renderFunction = (): void => {
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

    window.addEventListener('resize', (): void => this.engine.resize());
  }

  private async initMenu(): Promise<void> {
    const { scene, shadowGenerator } = await this.sceneManager.createMenuScene();
    this.uiManager = UIManager.initialize(scene);

    const levelLoader = new LevelLoader(scene, shadowGenerator);
    await levelLoader.loadLevelData(LEVELS['training_ground']);

    const menuCamera = new UniversalCamera('menuCamera', new Vector3(0, 2, -10), scene);
    menuCamera.setTarget(Vector3.Zero());
    scene.activeCamera = menuCamera;
    this.setupUIManagerEvents();
    this.uiManager.showScreen(UIScreen.LOGIN);

    if (!this.isRunning) {
      this.engine.runRenderLoop(this.renderFunction);
    }
  }

  private setupUIManagerEvents(): void {
    const lm = LifetimeManager.getInstance();

    lm.trackObserver(
      this.uiManager.onLogin,
      this.uiManager.onLogin.add((name: string): void => {
        this.playerName = name;
        console.log(`Player logging in as: ${this.playerName}`);
        this.uiManager.showScreen(UIScreen.MAIN_MENU);
      })
    );

    lm.trackObserver(
      this.uiManager.onStartSingleplayer,
      this.uiManager.onStartSingleplayer.add(() => {
        // Test: Start with Time Attack mode temporarily
        this.start('single', 'time_attack');
      })
    );

    lm.trackObserver(
      this.uiManager.onStartMultiplayer,
      this.uiManager.onStartMultiplayer.add(() => {
        // Start connection to Network (Photon)
        NetworkManager.getInstance().connect(this.playerName);
        this.uiManager.showScreen(UIScreen.LOBBY);
      })
    );

    // Listen for room join
    const nm = NetworkManager.getInstance();
    lm.trackObserver(
      nm.onStateChanged,
      nm.onStateChanged.add((state) => this.handleNetworkStateChange(state))
    );

    lm.trackObserver(
      this.uiManager.onResume,
      this.uiManager.onResume.add(() => this.resume())
    );
    lm.trackObserver(
      this.uiManager.onAbort,
      this.uiManager.onAbort.add(() => this.quitToMenu())
    );
  }

  private handleNetworkStateChange(state: NetworkState): void {
    if (state === NetworkState.InRoom && !this.isRunning) {
      this.start('multi');
    }
  }

  public async start(mode: GameMode = 'single', ruleType: string = 'survival'): Promise<void> {
    if (this.isRunning) return;
    this.currentMode = mode;

    // Use map selected from UI (or synchronized from room if multi)
    let mapKey = this.uiManager.getSelectedMap();
    if (mode === 'multi') {
      const syncedMap = NetworkManager.getInstance().getMapId();
      if (syncedMap) {
        mapKey = syncedMap;
        console.log(`[Game] Using synchronized map: ${mapKey}`);
      }
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
    await this.sessionController.setup(levelData, mode, this.playerName);

    // Ensure the player camera is active
    if (this.sessionController.getPlayerCamera()) {
      scene.activeCamera = this.sessionController.getPlayerCamera();
    }

    // Listen for player death to trigger Game Over logic via Rule
    LifetimeManager.getInstance().trackObserver(
      GameObservables.playerDied,
      GameObservables.playerDied.add((player) => {
        if (this.isRunning && !this.isPaused && this.currentRule) {
          this.currentRule.onPlayerDied(player as PlayerPawn);
        }
      })
    );

    // Initialize Game Rule
    switch (ruleType) {
      case 'time_attack':
        this.currentRule = new TimeAttackRule(this);
        break;
      case 'survival':
      default:
        this.currentRule = new SurvivalRule(this);
        break;
    }
    this.currentRule.onStart();

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

  // Deprecated/Removed: gameOver logic is now in SurvivalRule
  // private gameOver(): void { ... }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
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
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
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
    LifetimeManager.getInstance().dispose();
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
    this.sessionController?.tick(deltaTime);
    if (this.currentRule) {
      this.currentRule.onUpdate(deltaTime);
    }
  }
}
