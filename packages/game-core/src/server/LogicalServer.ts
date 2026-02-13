import { NullEngine, Scene, ArcRotateCamera, Vector3 } from '@babylonjs/core';
import { IServerNetworkAuthority } from './IServerNetworkAuthority.js';
import { RequestHitData, Vector3 as commonVector3, Logger, EventCode } from '@ante/common';
import { WorldSimulation } from '../simulation/WorldSimulation.js';
import { IGameRule } from '../rules/IGameRule.js';
import { WaveSurvivalRule } from '../rules/WaveSurvivalRule.js';
import { ShootingRangeRule } from '../rules/ShootingRangeRule.js';
import { DeathmatchRule } from '../rules/DeathmatchRule.js';
import { HitRegistrationSystem } from '../systems/HitRegistrationSystem.js';
import { ServerEnemyManager } from './managers/ServerEnemyManager.js';
import { ServerPickupManager } from './managers/ServerPickupManager.js';
import { ServerTargetSpawner } from './managers/ServerTargetSpawner.js';
import { ServerPlayerPawn } from './pawns/ServerPlayerPawn.js';
import { TickManager } from '../systems/TickManager.js';
import { IServerAssetLoader } from './IServerAssetLoader.js';
import { LevelData } from '../levels/LevelData.js';
import { ServerLevelLoader } from '../levels/ServerLevelLoader.js';
import { ServerGameContext } from '../types/ServerGameContext.js';
import { WorldEntityManager } from '../simulation/WorldEntityManager.js';
import { DamageSystem } from '../systems/DamageSystem.js';

const logger = new Logger('LogicalServer');

/**
 * 게임 로직을 수행하는 핵심 서버 클래스.
 */
export interface LogicalServerOptions {
  isTakeover?: boolean;
  gameMode?: string;
  tickManager?: TickManager;
  worldManager?: WorldEntityManager;
}

export class LogicalServer {
  private networkManager: IServerNetworkAuthority;
  private assetLoader: IServerAssetLoader;
  private isRunning = false;
  private isTakeover: boolean;

  private engine: NullEngine;
  private scene: Scene;
  private simulation: WorldSimulation;
  private enemyManager: ServerEnemyManager;
  private targetSpawner: ServerTargetSpawner;
  private tickManager: TickManager;
  private worldManager: WorldEntityManager;
  private ctx: ServerGameContext;

  private playerPawns: Map<string, ServerPlayerPawn> = new Map();
  private levelLoader: ServerLevelLoader;

  constructor(
    networkManager: IServerNetworkAuthority,
    assetLoader: IServerAssetLoader,
    options?: LogicalServerOptions
  ) {
    this.networkManager = networkManager;
    this.assetLoader = assetLoader;
    this.isTakeover = options?.isTakeover ?? false;

    this.engine = new NullEngine();
    this.scene = new Scene(this.engine);

    this.tickManager = options?.tickManager ?? new TickManager();
    this.worldManager = options?.worldManager ?? new WorldEntityManager(this.tickManager);

    this.ctx = {
      scene: this.scene,
      tickManager: this.tickManager,
      networkManager: this.networkManager,
      worldManager: this.worldManager,
    };

    this.enemyManager = new ServerEnemyManager(this.ctx, () => this.playerPawns);
    this.targetSpawner = new ServerTargetSpawner(this.ctx);

    this.simulation = new WorldSimulation(
      this.enemyManager,
      new ServerPickupManager(this.networkManager),
      this.targetSpawner,
      this.networkManager
    );

    const gameMode = options?.gameMode ?? 'survival';
    const gameRule = this.createGameRule(gameMode);
    this.simulation.setGameRule(gameRule);
    logger.info(`Game mode set to: ${gameMode}`);

    this.levelLoader = new ServerLevelLoader(this.scene);

    const camera = new ArcRotateCamera('ServerCamera', 0, 0, 10, Vector3.Zero(), this.scene);
    logger.info(`Camera created: ${camera.name}`);

    this.setupNetworkEvents();
    this.networkManager.registerAllActors();

    logger.info('Physics World Initialized');
  }

  private setupNetworkEvents(): void {
    this.networkManager.onPlayerJoin = (id: string, name: string): void => {
      this.createPlayerPawn(id, name);
      if (!this.isTakeover && this.playerPawns.size === 1) {
        this.simulation.initializeRequest();
      }
    };
    this.networkManager.onPlayerLeave = (id: string): void => this.removePlayerPawn(id);
    this.networkManager.onPlayerMove = (id: string, pos: commonVector3, rot: commonVector3): void =>
      this.updatePlayerPawn(id, pos, rot);
    this.networkManager.onFireRequest = (
      id: string,
      origin: commonVector3,
      dir: commonVector3
    ): void => this.processFireEvent(id, origin, dir);

    this.networkManager.onReloadRequest = (playerId: string, weaponId: string): void => {
      const pawn = this.playerPawns.get(playerId);
      if (pawn) {
        pawn.reloadRequest();
        this.networkManager.broadcastReload(playerId, weaponId);
      }
    };

    this.networkManager.onHitRequest = (shooterId: string, data: RequestHitData): void =>
      this.processHitRequest(shooterId, data);

    this.networkManager.onSyncWeaponRequest = (playerId: string, weaponId: string): void =>
      this.processSyncWeapon(playerId, weaponId);
  }

  private createGameRule(mode: string): IGameRule {
    switch (mode) {
      case 'shooting_range':
        return new ShootingRangeRule();
      case 'deathmatch':
        return new DeathmatchRule();
      case 'survival':
      default:
        return new WaveSurvivalRule();
    }
  }

  public start(): void {
    if (this.isRunning) return;
    logger.info('Starting Game Simulation...');
    this.isRunning = true;

    let lastTickTime = performance.now();
    const tickInterval = 50; // 20Hz network update rate (improved from 128Hz)
    let lastClock = performance.now();

    this.engine.runRenderLoop(() => {
      if (!this.isRunning) return;

      const currentTime = performance.now();
      const deltaTime = (currentTime - lastClock) / 1000;
      lastClock = currentTime;

      this.tickManager.tick(deltaTime);
      this.scene.render();

      if (currentTime - lastTickTime >= tickInterval) {
        const enemyStates = this.enemyManager.getEnemyStates();
        this.networkManager.broadcastState(enemyStates);
        lastTickTime = currentTime;
      }
    });
  }

  public loadLevel(data: LevelData): void {
    logger.info('Loading Level Data into LogicalServer...');
    this.levelLoader.loadLevelData(data);
  }

  private createPlayerPawn(id: string, name: string): void {
    if (this.playerPawns.has(id)) return;

    const pawn = new ServerPlayerPawn(id, this.ctx, new Vector3(0, 1.75, 0), this.assetLoader);
    pawn.name = name; // Assign proper name for isServerPlayerEntity check
    this.playerPawns.set(id, pawn);
    this.worldManager.register(pawn);
  }

  public updatePlayerPawn(id: string, pos: commonVector3, rot?: commonVector3 | null): void {
    const pawn = this.playerPawns.get(id);
    if (pawn && pawn.mesh) {
      pawn.mesh.position.set(pos.x, pos.y, pos.z);
      if (rot) pawn.mesh.rotation.set(rot.x, rot.y, rot.z);
    }

    const state = this.networkManager.getPlayerState(id);
    if (state) {
      state.position = { x: pos.x, y: pos.y, z: pos.z };
      if (rot) {
        state.rotation = { x: rot.x, y: rot.y, z: rot.z };
      }
    }
  }

  private removePlayerPawn(id: string): void {
    const pawn = this.playerPawns.get(id);
    if (pawn) {
      this.worldManager.unregister(id);
      this.playerPawns.delete(id);
      logger.info(`Removed Pawn for Player: ${id}`);
    }
  }

  public processFireEvent(
    playerId: string,
    origin: commonVector3,
    direction: commonVector3,
    weaponIdOverride?: string
  ): void {
    const pawn = this.playerPawns.get(playerId);
    if (!pawn) return;

    const canFire = pawn.fireRequest();

    if (canFire) {
      this.networkManager.sendEvent(EventCode.FIRE, {
        playerId,
        weaponId: weaponIdOverride || pawn.currentWeapon?.id || 'Unknown',
        muzzleTransform: { position: origin, direction: direction },
      });
    }
  }

  public processHitRequest(shooterId: string, data: RequestHitData): void {
    if (!data.targetId || data.targetId === 'ground') return;

    if (data.origin && data.direction) {
      const rayOrigin = new Vector3(data.origin.x, data.origin.y, data.origin.z);
      const rayDirection = new Vector3(data.direction.x, data.direction.y, data.direction.z);

      const targetMesh =
        this.enemyManager.getEnemyMesh(data.targetId) ||
        this.targetSpawner.getTargetMesh(data.targetId) ||
        this.playerPawns.get(data.targetId)?.mesh;

      if (targetMesh) {
        const validation = HitRegistrationSystem.validateHit(
          this.scene,
          data.targetId,
          rayOrigin,
          rayDirection,
          targetMesh,
          0.8
        );

        if (validation.isValid) {
          const pawn = this.playerPawns.get(data.targetId);
          const shooterPawn = this.playerPawns.get(shooterId);
          const weaponDamage = (shooterPawn?.currentWeapon?.stats as { damage?: number } | undefined)
            ?.damage;
          const baseDamage =
            typeof weaponDamage === 'number' && weaponDamage > 0 ? weaponDamage : data.damage;
          const finalDamage = pawn
            ? DamageSystem.calculateDamage(baseDamage, validation.part, pawn.damageProfile)
            : baseDamage;
          let newHealth = 0;
          let wasAlive = false;

          // Player Logic
          if (pawn) {
            newHealth = Math.max(0, pawn.health - finalDamage);
            wasAlive = !pawn.isDead;
            pawn.health = newHealth;

            // Trigger valid death
            if (newHealth <= 0 && wasAlive) {
              pawn.isDead = true;
              const canRespawn = this.simulation.gameRule?.allowRespawn === true;
              const respawnDelaySeconds = canRespawn
                ? (this.simulation.gameRule?.respawnDelay ?? 0)
                : 0;
              const gameMode = this.simulation.gameRule?.modeId;

              this.networkManager.broadcastDeath(
                data.targetId,
                shooterId,
                respawnDelaySeconds,
                canRespawn,
                gameMode
              );
              this.handlePlayerDeath(data.targetId, shooterId);
            }
          }
          // Generic State (Enemy/Target fallback)
          else {
            const targetState = this.networkManager.getPlayerState(data.targetId);
            if (targetState) {
              newHealth = Math.max(0, targetState.health - finalDamage);
            }
          }

          const isPlayer = !!pawn;
          const eventCode = isPlayer ? EventCode.HIT : EventCode.TARGET_HIT;

          this.networkManager.broadcastHit(
            {
              targetId: data.targetId,
              damage: finalDamage,
              attackerId: shooterId,
              part: validation.part,
              newHealth: newHealth,
            },
            eventCode
          );
        }
      }
    }
  }

  private handlePlayerDeath(targetId: string, _attackerId: string): void {
    if (this.simulation.gameRule) {
      const decision = this.simulation.gameRule.onPlayerDeath(this.simulation, targetId);
      if (decision.action === 'respawn') {
        const delayMs = decision.delay * 1000;
        logger.info(`Player ${targetId} died. Respawning in ${decision.delay}s`);

        setTimeout(() => {
          const spawnPos = decision.position || { x: 0, y: 1.75, z: 0 };

          // Server-side state reset
          const pawn = this.playerPawns.get(targetId);
          if (pawn) {
            pawn.health = 100; // or maxHealth
            pawn.isDead = false;
            this.updatePlayerPawn(
              targetId,
              { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
              undefined
            );
            logger.info(
              `Server-side Pawn ${targetId} revived at ${spawnPos.x}, ${spawnPos.y}, ${spawnPos.z}`
            );
          }

          this.networkManager.broadcastRespawn(targetId, spawnPos);
        }, delayMs);
      }
    }
  }

  public processSyncWeapon(playerId: string, weaponId: string): void {
    const pawn = this.playerPawns.get(playerId);
    if (pawn) {
      pawn.equipWeapon(weaponId);
      logger.info(`ServerPlayerPawn ${playerId} synced weapon to ${weaponId}`);
    }
  }

  public stop(): void {
    this.isRunning = false;
    this.engine.dispose();
  }
}
