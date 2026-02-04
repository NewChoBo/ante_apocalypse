/**
 * PlayerLifecycleManager
 *
 * Player lifecycle manager separated from SessionController
 * - Player creation and initialization
 * - Player state management
 * - Respawn handling
 */
import { Scene, Vector3 } from '@babylonjs/core';
import { LevelData } from '@ante/game-core';
import { PlayerPawn } from '../PlayerPawn';
import { PlayerController } from '../controllers/PlayerController';
import { CombatComponent } from '../components/CombatComponent';
import { HUD } from '../../ui/HUD';
import { WorldEntityManager } from './WorldEntityManager';
import { Logger } from '@ante/common';

const logger = new Logger('PlayerLifecycleManager');

export interface PlayerLifecycleConfig {
  scene: Scene;
  canvas: HTMLCanvasElement;
  levelData: LevelData;
  playerName: string;
}

export interface PlayerLifecycleState {
  isInitialized: boolean;
  isDead: boolean;
  isSpectating: boolean;
}

export class PlayerLifecycleManager {
  private scene: Scene;
  private canvas: HTMLCanvasElement;
  private levelData: LevelData;

  // Game Objects
  private playerPawn: PlayerPawn | null = null;
  private playerController: PlayerController | null = null;
  private hud: HUD | null = null;
  private combatComponent: CombatComponent | null = null;

  // State
  private state: PlayerLifecycleState = {
    isInitialized: false,
    isDead: false,
    isSpectating: false,
  };

  constructor(config: PlayerLifecycleConfig) {
    this.scene = config.scene;
    this.canvas = config.canvas;
    this.levelData = config.levelData;
  }

  /**
   * Initialize player
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing player...');

      // Create player Pawn
      this.playerPawn = new PlayerPawn(this.scene);
      WorldEntityManager.getInstance().initialize();
      WorldEntityManager.getInstance().register(this.playerPawn);

      // Get spawn position from level data
      if (this.levelData.playerSpawn) {
        this.playerPawn.position = Vector3.FromArray(this.levelData.playerSpawn);
      } else {
        this.playerPawn.position = new Vector3(0, 1.75, -5);
      }

      // Create controller and set possession
      this.playerController = new PlayerController('player1', this.canvas);
      this.playerController.possess(this.playerPawn);

      // Create HUD
      this.hud = new HUD();

      // Add combat component
      this.combatComponent = new CombatComponent(this.playerPawn, this.scene);
      this.playerPawn.addComponent(this.combatComponent);

      this.state.isInitialized = true;
      logger.info('Player initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize player', error);
      throw error;
    }
  }

  /**
   * Handle player death
   */
  public handlePlayerDeath(): void {
    if (!this.state.isInitialized || this.state.isDead) return;

    logger.info('Player died');
    this.state.isDead = true;
    this.state.isSpectating = true;

    // Show respawn countdown on HUD
    this.hud?.showRespawnCountdown(3);
  }

  /**
   * Handle player respawn
   */
  public handleRespawn(): void {
    if (!this.state.isInitialized || !this.state.isDead) return;

    logger.info('Player respawned');
    this.state.isDead = false;
    this.state.isSpectating = false;

    // Hide HUD respawn message
    this.hud?.hideRespawnMessage();
  }

  /**
   * Transition to spectator mode
   */
  public transitionToSpectatorMode(): void {
    this.state.isSpectating = true;
    this.handlePlayerDeath();
  }

  /**
   * Exit spectator mode
   */
  public exitSpectatorMode(): void {
    this.state.isSpectating = false;
  }

  /**
   * Get player info
   */
  public getPlayerPawn(): PlayerPawn | null {
    return this.playerPawn;
  }

  public getPlayerController(): PlayerController | null {
    return this.playerController;
  }

  public getHUD(): HUD | null {
    return this.hud;
  }

  public getCombatComponent(): CombatComponent | null {
    return this.combatComponent;
  }

  /**
   * Get state
   */
  public getState(): Readonly<PlayerLifecycleState> {
    return { ...this.state };
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    this.combatComponent?.dispose();
    this.playerController?.dispose();
    this.playerPawn?.dispose();
    this.hud?.dispose();

    this.playerPawn = null;
    this.playerController = null;
    this.hud = null;
    this.combatComponent = null;

    this.state = {
      isInitialized: false,
      isDead: false,
      isSpectating: false,
    };

    logger.info('PlayerLifecycleManager disposed');
  }
}
