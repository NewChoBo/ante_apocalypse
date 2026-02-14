import { NullEngine, Scene, ArcRotateCamera, Vector3 } from '@babylonjs/core';
import { IServerNetworkAuthority } from './IServerNetworkAuthority.js';
import {
  RequestHitData,
  UpgradePickPayload,
  UpgradeOfferPayload,
  UpgradeApplyPayload,
  Vector3 as commonVector3,
  Logger,
  EventCode,
  GameEndEventData,
  WaveStatePayload,
} from '@ante/common';
import { WorldSimulation } from '../simulation/WorldSimulation.js';
import { IGameRule, RespawnDecision, GameEndResult } from '../rules/IGameRule.js';
import { WaveSurvivalRule } from '../rules/WaveSurvivalRule.js';
import { LegacyWaveSurvivalRule } from '../rules/LegacyWaveSurvivalRule.js';
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
import { syncBabylonLoggerWithAnte } from '../utils/BabylonLogger.js';

const logger = new Logger('LogicalServer');

type QueuedRespawn = {
  playerId: string;
  decision: Extract<RespawnDecision, { action: 'respawn' }>;
};

type WaveRuleSideEffects = {
  consumeQueuedRespawns?: () => QueuedRespawn[];
  consumeWaveStateEvents?: () => WaveStatePayload[];
  consumeUpgradeOfferEvents?: () => UpgradeOfferPayload[];
  consumeUpgradeApplyEvents?: () => UpgradeApplyPayload[];
  pickUpgrade?: (playerId: string, offerId: string, upgradeId: string) => UpgradeApplyPayload | null;
  getDamageMultiplier?: (playerId: string) => number;
  getDefenseMultiplier?: (playerId: string) => number;
  getMaxHealthBonus?: (playerId: string) => number;
  getWaveReached?: () => number;
};

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
  private hasGameEnded = false;
  private matchStartTime = 0;

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
  private respawnTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  private killCounts: Map<string, number> = new Map();
  private deathCounts: Map<string, number> = new Map();
  private damageDealt: Map<string, number> = new Map();

  constructor(
    networkManager: IServerNetworkAuthority,
    assetLoader: IServerAssetLoader,
    options?: LogicalServerOptions
  ) {
    syncBabylonLoggerWithAnte();

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
      this.simulation.gameRule?.onPlayerJoin(this.simulation, id);
    };

    this.networkManager.onPlayerLeave = (id: string): void => {
      this.clearPendingRespawn(id);
      this.simulation.gameRule?.onPlayerLeave(this.simulation, id);
      this.removePlayerPawn(id);
    };

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

    this.networkManager.onUpgradePickRequest = (
      playerId: string,
      data: UpgradePickPayload
    ): void => {
      this.handleUpgradePickRequest(playerId, data);
    };
  }

  private createGameRule(mode: string): IGameRule {
    switch (mode) {
      case 'shooting_range':
        return new ShootingRangeRule();
      case 'deathmatch':
        return new DeathmatchRule();
      case 'survival': {
        const ruleset = this.networkManager.getCurrentRoomProperty<string>('survivalRuleset');
        if (ruleset === 'v2') {
          return new WaveSurvivalRule();
        }
        logger.info('Using legacy survival ruleset (set room property survivalRuleset=v2 for new flow)');
        return new LegacyWaveSurvivalRule();
      }
      default:
        return new WaveSurvivalRule();
    }
  }

  public start(): void {
    if (this.isRunning) return;
    logger.info('Starting Game Simulation...');
    this.isRunning = true;
    this.hasGameEnded = false;
    this.matchStartTime = performance.now();

    let lastTickTime = performance.now();
    const tickInterval = 50; // 20Hz network update rate
    let lastClock = performance.now();

    this.engine.runRenderLoop(() => {
      if (!this.isRunning) return;

      const currentTime = performance.now();
      const deltaTime = (currentTime - lastClock) / 1000;
      lastClock = currentTime;

      this.tickManager.tick(deltaTime);
      this.simulation.update(deltaTime);
      this.processRuleSideEffects();
      this.checkAndBroadcastGameEnd();

      this.scene.render();

      if (!this.isRunning) return;
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
    pawn.name = name;
    this.playerPawns.set(id, pawn);
    this.worldManager.register(pawn);

    this.killCounts.set(id, this.killCounts.get(id) ?? 0);
    this.deathCounts.set(id, this.deathCounts.get(id) ?? 0);
    this.damageDealt.set(id, this.damageDealt.get(id) ?? 0);
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
    if (!canFire) return;

    this.networkManager.sendEvent(EventCode.FIRE, {
      playerId,
      weaponId: weaponIdOverride || pawn.currentWeapon?.id || 'Unknown',
      muzzleTransform: { position: origin, direction: direction },
    });
  }

  public processHitRequest(shooterId: string, data: RequestHitData): void {
    if (!data.targetId || data.targetId === 'ground') return;
    if (!data.origin || !data.direction) return;

    const rayOrigin = new Vector3(data.origin.x, data.origin.y, data.origin.z);
    const rayDirection = new Vector3(data.direction.x, data.direction.y, data.direction.z);

    const targetMesh =
      this.enemyManager.getEnemyMesh(data.targetId) ||
      this.targetSpawner.getTargetMesh(data.targetId) ||
      this.playerPawns.get(data.targetId)?.mesh;
    if (!targetMesh) return;

    const validation = HitRegistrationSystem.validateHit(
      this.scene,
      data.targetId,
      rayOrigin,
      rayDirection,
      targetMesh,
      0.8
    );
    if (!validation.isValid) return;

    const baseDamage = this.resolveBaseDamage(shooterId, data.damage);
    const part = validation.part || data.part || 'body';

    if (this.playerPawns.has(data.targetId)) {
      this.applyPlayerHit(data.targetId, shooterId, baseDamage, part);
      return;
    }

    const enemyPawn = this.enemyManager.getEnemyPawn(data.targetId);
    if (enemyPawn) {
      this.applyEnemyHit(data.targetId, shooterId, baseDamage, part);
      return;
    }

    const targetPawn = this.targetSpawner.getTargetPawn(data.targetId);
    if (targetPawn) {
      this.applyTargetHit(data.targetId, shooterId, baseDamage, part);
    }
  }

  private applyPlayerHit(targetId: string, shooterId: string, baseDamage: number, part: string): void {
    const pawn = this.playerPawns.get(targetId);
    if (!pawn || pawn.isDead) return;

    const rawDamage = DamageSystem.calculateDamage(baseDamage, part, pawn.damageProfile);
    const finalDamage = Math.max(
      1,
      Math.floor(rawDamage * this.getPlayerDefenseMultiplier(targetId))
    );
    this.trackDamage(shooterId, finalDamage);
    pawn.takeDamage(finalDamage, shooterId, part);

    this.networkManager.broadcastHit(
      {
        targetId,
        damage: finalDamage,
        attackerId: shooterId,
        part,
        newHealth: pawn.health,
      },
      EventCode.HIT
    );

    if (!pawn.isDead) return;

    this.incrementCounter(this.deathCounts, targetId, 1);
    if (shooterId && shooterId !== targetId) {
      this.incrementCounter(this.killCounts, shooterId, 1);
    }

    const canRespawn = this.simulation.gameRule?.allowRespawn === true;
    const respawnDelaySeconds = canRespawn ? (this.simulation.gameRule?.respawnDelay ?? 0) : 0;

    this.networkManager.broadcastDeath(
      targetId,
      shooterId,
      respawnDelaySeconds,
      canRespawn,
      this.simulation.gameRule?.modeId
    );
    this.handlePlayerDeath(targetId, shooterId);
  }

  private applyEnemyHit(targetId: string, shooterId: string, baseDamage: number, part: string): void {
    const enemy = this.enemyManager.getEnemyPawn(targetId);
    if (!enemy || enemy.isDead) return;

    const finalDamage = DamageSystem.calculateDamage(baseDamage, part, enemy.damageProfile);
    this.trackDamage(shooterId, finalDamage);
    enemy.takeDamage(finalDamage, shooterId, part);

    this.networkManager.sendEvent(EventCode.ENEMY_HIT, {
      id: targetId,
      damage: finalDamage,
    });

    if (!enemy.isDead) return;
    this.enemyManager.destroyEnemy(targetId);
  }

  private applyTargetHit(targetId: string, shooterId: string, baseDamage: number, part: string): void {
    const target = this.targetSpawner.getTargetPawn(targetId);
    if (!target || target.isDead) return;

    const finalDamage = DamageSystem.calculateDamage(baseDamage, part, target.damageProfile);
    this.trackDamage(shooterId, finalDamage);
    target.takeDamage(finalDamage);

    this.networkManager.sendEvent(EventCode.TARGET_HIT, {
      targetId,
      part,
      damage: finalDamage,
    });

    if (!target.isDead) return;
    this.targetSpawner.broadcastTargetDestroy(targetId);
  }

  private resolveBaseDamage(shooterId: string, fallbackDamage: number): number {
    const shooterPawn = this.playerPawns.get(shooterId);
    const weaponDamage = (shooterPawn?.currentWeapon?.stats as { damage?: number } | undefined)
      ?.damage;
    const baseDamage =
      typeof weaponDamage === 'number' && weaponDamage > 0 ? weaponDamage : fallbackDamage;
    return Math.max(1, Math.floor(baseDamage * this.getPlayerDamageMultiplier(shooterId)));
  }

  private getPlayerDamageMultiplier(playerId: string): number {
    const rule = this.simulation.gameRule as WaveRuleSideEffects | null;
    if (!rule?.getDamageMultiplier) return 1;
    return Math.max(0.1, rule.getDamageMultiplier(playerId));
  }

  private getPlayerDefenseMultiplier(playerId: string): number {
    const rule = this.simulation.gameRule as WaveRuleSideEffects | null;
    if (!rule?.getDefenseMultiplier) return 1;
    return Math.max(0.1, rule.getDefenseMultiplier(playerId));
  }

  private getPlayerMaxHealthBonus(playerId: string): number {
    const rule = this.simulation.gameRule as WaveRuleSideEffects | null;
    if (!rule?.getMaxHealthBonus) return 0;
    return Math.max(0, rule.getMaxHealthBonus(playerId));
  }

  private applyPlayerUpgradeEffects(apply: UpgradeApplyPayload): void {
    const pawn = this.playerPawns.get(apply.playerId);
    if (!pawn) return;

    if (apply.upgradeId === 'max_hp_amp') {
      const maxHealthBonus = this.getPlayerMaxHealthBonus(apply.playerId);
      pawn.maxHealth = 100 + maxHealthBonus;
      pawn.health = Math.min(pawn.maxHealth, pawn.health + 25);
      const state = this.networkManager.getPlayerState(apply.playerId);
      if (state) {
        state.health = pawn.health;
      }
    }
  }

  private handleUpgradePickRequest(playerId: string, data: UpgradePickPayload): void {
    const rule = this.simulation.gameRule as WaveRuleSideEffects | null;
    if (!rule?.pickUpgrade) return;
    rule.pickUpgrade(playerId, data.offerId, data.upgradeId);
  }

  private processUpgradeEvents(rule: WaveRuleSideEffects): void {
    if (rule.consumeUpgradeOfferEvents) {
      const offers = rule.consumeUpgradeOfferEvents();
      for (const offer of offers) {
        this.networkManager.sendEvent(EventCode.UPGRADE_OFFER, offer, true);
      }
    }

    if (rule.consumeUpgradeApplyEvents) {
      const applyEvents = rule.consumeUpgradeApplyEvents();
      for (const apply of applyEvents) {
        this.applyPlayerUpgradeEffects(apply);
        this.networkManager.sendEvent(EventCode.UPGRADE_APPLY, apply, true);
      }
    }
  }

  private handlePlayerDeath(targetId: string, attackerId: string): void {
    const gameRule = this.simulation.gameRule;
    if (!gameRule) return;

    const decision = gameRule.onPlayerDeath(this.simulation, targetId, attackerId);
    if (decision.action !== 'respawn') return;
    this.scheduleRespawn(targetId, decision);
  }

  private scheduleRespawn(
    playerId: string,
    decision: Extract<RespawnDecision, { action: 'respawn' }>
  ): void {
    this.clearPendingRespawn(playerId);
    const delayMs = Math.max(0, decision.delay) * 1000;
    const spawnPos = decision.position || { x: 0, y: 1.75, z: 0 };

    logger.info(`Player ${playerId} respawn scheduled in ${decision.delay}s`);
    const timer = setTimeout(() => {
      this.respawnTimers.delete(playerId);

      const pawn = this.playerPawns.get(playerId);
      if (!pawn) return;

      pawn.health = pawn.maxHealth;
      pawn.isDead = false;
      this.updatePlayerPawn(playerId, { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z }, undefined);
      this.networkManager.broadcastRespawn(playerId, spawnPos);
    }, delayMs);

    this.respawnTimers.set(playerId, timer);
  }

  private clearPendingRespawn(playerId: string): void {
    const timer = this.respawnTimers.get(playerId);
    if (!timer) return;
    clearTimeout(timer);
    this.respawnTimers.delete(playerId);
  }

  private processRuleSideEffects(): void {
    const rule = this.simulation.gameRule as WaveRuleSideEffects | null;
    if (!rule) return;

    this.processUpgradeEvents(rule);

    if (rule.consumeWaveStateEvents) {
      const waveEvents = rule.consumeWaveStateEvents();
      for (const waveEvent of waveEvents) {
        this.networkManager.sendEvent(EventCode.WAVE_STATE, waveEvent, true);
      }
    }

    if (rule.consumeQueuedRespawns) {
      const queuedRespawns = rule.consumeQueuedRespawns();
      for (const entry of queuedRespawns) {
        this.scheduleRespawn(entry.playerId, entry.decision);
      }
    }
  }

  private checkAndBroadcastGameEnd(): void {
    if (this.hasGameEnded) return;
    const gameRule = this.simulation.gameRule;
    if (!gameRule) return;

    const result = gameRule.checkGameEnd(this.simulation);
    if (!result) return;

    this.broadcastGameEnd(result);
  }

  private broadcastGameEnd(result: GameEndResult): void {
    const stats = this.buildGameEndStats();
    const payload: GameEndEventData = {
      winnerId: result.winnerId,
      winnerTeam: result.winnerTeam,
      reason: result.reason,
      stats,
    };

    this.networkManager.sendEvent(EventCode.GAME_END, payload, true);
    this.hasGameEnded = true;
    this.isRunning = false;
    logger.info(`Game ended: ${result.reason}`);
  }

  private buildGameEndStats(): GameEndEventData['stats'] {
    const durationSeconds = Math.max(0, Math.floor((performance.now() - this.matchStartTime) / 1000));
    const waveReached =
      (this.simulation.gameRule as WaveRuleSideEffects | null)?.getWaveReached?.() ?? undefined;

    return {
      durationSeconds,
      waveReached,
      kills: Object.fromEntries(this.killCounts),
      deaths: Object.fromEntries(this.deathCounts),
      damageDealt: Object.fromEntries(this.damageDealt),
    };
  }

  private trackDamage(playerId: string, amount: number): void {
    if (!playerId || amount <= 0) return;
    this.incrementCounter(this.damageDealt, playerId, amount);
  }

  private incrementCounter(counter: Map<string, number>, key: string, delta: number): void {
    if (!key) return;
    counter.set(key, (counter.get(key) || 0) + delta);
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
    this.respawnTimers.forEach((timer) => clearTimeout(timer));
    this.respawnTimers.clear();
    this.engine.dispose();
  }
}
