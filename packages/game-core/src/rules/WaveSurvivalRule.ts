import { IGameRule, RespawnDecision, GameEndResult } from './IGameRule.js';
import { WorldSimulation } from '../simulation/WorldSimulation.js';
import { Vector3 } from '@babylonjs/core';
import { WaveStatePayload, UpgradeOfferPayload, UpgradeApplyPayload } from '@ante/common';

type RandomSource = () => number;
type SurvivalPhase = 'warmup' | 'combat' | 'intermission' | 'upgrade' | 'ended';

type QueuedRespawn = {
  playerId: string;
  decision: Extract<RespawnDecision, { action: 'respawn' }>;
};

type WaveConfig = {
  totalEnemies: number;
  maxAlive: number;
  spawnInterval: number;
  healthMultiplier: number;
  damageMultiplier: number;
};

type UpgradeDefinition = {
  id: string;
  label: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic';
};

const WAVE_CONFIGS: ReadonlyArray<WaveConfig> = [
  {
    totalEnemies: 10,
    maxAlive: 6,
    spawnInterval: 2.0,
    healthMultiplier: 1.0,
    damageMultiplier: 1.0,
  },
  {
    totalEnemies: 14,
    maxAlive: 8,
    spawnInterval: 1.8,
    healthMultiplier: 1.12,
    damageMultiplier: 1.08,
  },
  {
    totalEnemies: 18,
    maxAlive: 10,
    spawnInterval: 1.6,
    healthMultiplier: 1.24,
    damageMultiplier: 1.16,
  },
  {
    totalEnemies: 22,
    maxAlive: 12,
    spawnInterval: 1.4,
    healthMultiplier: 1.36,
    damageMultiplier: 1.24,
  },
  {
    totalEnemies: 26,
    maxAlive: 14,
    spawnInterval: 1.25,
    healthMultiplier: 1.48,
    damageMultiplier: 1.32,
  },
  {
    totalEnemies: 30,
    maxAlive: 16,
    spawnInterval: 1.1,
    healthMultiplier: 1.6,
    damageMultiplier: 1.4,
  },
  {
    totalEnemies: 34,
    maxAlive: 18,
    spawnInterval: 1.0,
    healthMultiplier: 1.76,
    damageMultiplier: 1.48,
  },
  {
    totalEnemies: 40,
    maxAlive: 20,
    spawnInterval: 0.9,
    healthMultiplier: 1.9,
    damageMultiplier: 1.56,
  },
];

const ENEMY_SPAWN_POINTS: ReadonlyArray<Vector3> = [
  new Vector3(-16, 0, 16),
  new Vector3(-8, 0, 18),
  new Vector3(0, 0, 20),
  new Vector3(8, 0, 18),
  new Vector3(16, 0, 16),
  new Vector3(0, 0, 12),
];

const SAFE_RESPAWN_POINTS: ReadonlyArray<Vector3> = [
  new Vector3(-10, 1.75, -15),
  new Vector3(0, 1.75, -18),
  new Vector3(10, 1.75, -15),
  new Vector3(0, 1.75, -8),
];

const UPGRADE_POOL: ReadonlyArray<UpgradeDefinition> = [
  {
    id: 'damage_amp',
    label: 'Damage Amplifier',
    description: '+12% outgoing damage',
    rarity: 'common',
  },
  {
    id: 'defense_amp',
    label: 'Defense Matrix',
    description: '-10% incoming damage',
    rarity: 'common',
  },
  {
    id: 'max_hp_amp',
    label: 'Vital Surge',
    description: '+25 max HP and +25 instant heal',
    rarity: 'rare',
  },
  {
    id: 'reload_amp',
    label: 'Rapid Chamber',
    description: '-15% reload time',
    rarity: 'common',
  },
  {
    id: 'mag_amp',
    label: 'Extended Magazine',
    description: '+25% magazine size',
    rarity: 'rare',
  },
  {
    id: 'move_amp',
    label: 'Servo Boost',
    description: '+10% movement speed',
    rarity: 'epic',
  },
];

export class WaveSurvivalRule implements IGameRule {
  public readonly modeId = 'survival';
  public readonly allowRespawn = false;
  public readonly respawnDelay = 0;

  private readonly warmupDuration = 20;
  private readonly intermissionDuration = 20;
  private readonly upgradeDuration = 12;
  private readonly waveRespawnDelaySeconds = 3;

  private connectedPlayers: Set<string> = new Set();
  private alivePlayers: Set<string> = new Set();
  private downedPlayers: Set<string> = new Set();

  private phase: SurvivalPhase = 'warmup';
  private phaseTimeRemaining = this.warmupDuration;
  private currentWave = 0;
  private spawnedInWave = 0;
  private spawnAccumulator = 0;
  private waveStateAccumulator = 0;
  private queuedRespawns: QueuedRespawn[] = [];
  private pendingWaveStateEvents: WaveStatePayload[] = [];
  private pendingUpgradeOfferEvents: UpgradeOfferPayload[] = [];
  private pendingUpgradeApplyEvents: UpgradeApplyPayload[] = [];
  private pendingUpgradeOffers: Map<string, UpgradeOfferPayload> = new Map();
  private playerUpgradeStacks: Map<string, Map<string, number>> = new Map();
  private isFinished = false;

  constructor(private readonly randomSource: RandomSource = Math.random) {}

  public onInitialize(simulation: WorldSimulation): void {
    this.phase = 'warmup';
    this.phaseTimeRemaining = this.warmupDuration;
    this.currentWave = 0;
    this.spawnedInWave = 0;
    this.spawnAccumulator = 0;
    this.waveStateAccumulator = 0;
    this.queuedRespawns = [];
    this.pendingWaveStateEvents = [];
    this.pendingUpgradeOfferEvents = [];
    this.pendingUpgradeApplyEvents = [];
    this.pendingUpgradeOffers.clear();
    this.isFinished = false;
    this.downedPlayers.clear();
    this.playerUpgradeStacks.clear();
    this.connectedPlayers.forEach((playerId) => this.ensurePlayerStackMap(playerId));

    this.queueWaveState(simulation);
  }

  public onUpdate(simulation: WorldSimulation, deltaTime: number): void {
    if (deltaTime <= 0 || this.isFinished) return;

    if (this.phase === 'warmup') {
      this.phaseTimeRemaining -= deltaTime;
      if (this.phaseTimeRemaining <= 0) {
        this.startWave(simulation, 1);
      }
    } else if (this.phase === 'combat') {
      this.updateCombatPhase(simulation, deltaTime);
    } else if (this.phase === 'intermission') {
      this.phaseTimeRemaining -= deltaTime;
      if (this.phaseTimeRemaining <= 0) {
        this.startUpgrade(simulation);
      }
    } else if (this.phase === 'upgrade') {
      this.phaseTimeRemaining -= deltaTime;
      if (this.phaseTimeRemaining <= 0) {
        this.finalizePendingUpgradeOffers();
        this.startNextWaveOrEnd(simulation);
      }
    }

    this.waveStateAccumulator += deltaTime;
    if (this.waveStateAccumulator >= 1) {
      this.waveStateAccumulator = 0;
      this.queueWaveState(simulation);
    }
  }

  public onPlayerJoin(_simulation: WorldSimulation, playerId: string): void {
    this.connectedPlayers.add(playerId);
    this.alivePlayers.add(playerId);
    this.downedPlayers.delete(playerId);
    this.ensurePlayerStackMap(playerId);
  }

  public onPlayerLeave(_simulation: WorldSimulation, playerId: string): void {
    this.connectedPlayers.delete(playerId);
    this.alivePlayers.delete(playerId);
    this.downedPlayers.delete(playerId);
    this.queuedRespawns = this.queuedRespawns.filter((entry) => entry.playerId !== playerId);
    this.removePlayerUpgradeOffers(playerId);
  }

  public onPlayerDeath(
    _simulation: WorldSimulation,
    playerId: string,
    _killerId?: string
  ): RespawnDecision {
    this.alivePlayers.delete(playerId);
    if (this.connectedPlayers.has(playerId)) {
      this.downedPlayers.add(playerId);
    }
    return { action: 'spectate' };
  }

  public checkGameEnd(_simulation: WorldSimulation): GameEndResult | null {
    if (
      this.connectedPlayers.size > 0 &&
      this.alivePlayers.size === 0 &&
      this.queuedRespawns.length === 0
    ) {
      return { reason: 'All players eliminated' };
    }

    if (this.isFinished) {
      return { winnerTeam: 'players', reason: `Completed ${WAVE_CONFIGS.length} waves` };
    }

    return null;
  }

  public consumeQueuedRespawns(): QueuedRespawn[] {
    const queued = this.queuedRespawns;
    this.queuedRespawns = [];
    return queued;
  }

  public consumeWaveStateEvents(): WaveStatePayload[] {
    const events = this.pendingWaveStateEvents;
    this.pendingWaveStateEvents = [];
    return events;
  }

  public consumeUpgradeOfferEvents(): UpgradeOfferPayload[] {
    const offers = this.pendingUpgradeOfferEvents;
    this.pendingUpgradeOfferEvents = [];
    return offers;
  }

  public consumeUpgradeApplyEvents(): UpgradeApplyPayload[] {
    const applied = this.pendingUpgradeApplyEvents;
    this.pendingUpgradeApplyEvents = [];
    return applied;
  }

  public pickUpgrade(
    playerId: string,
    offerId: string,
    upgradeId: string
  ): UpgradeApplyPayload | null {
    const offer = this.pendingUpgradeOffers.get(offerId);
    if (!offer) return null;
    if (offer.playerId !== playerId) return null;
    if (!offer.options.some((option) => option.id === upgradeId)) return null;

    this.pendingUpgradeOffers.delete(offerId);
    return this.applyUpgrade(playerId, offerId, upgradeId);
  }

  public getDamageMultiplier(playerId: string): number {
    const stacks = this.getUpgradeStacks(playerId, 'damage_amp');
    return 1 + stacks * 0.12;
  }

  public getDefenseMultiplier(playerId: string): number {
    const stacks = this.getUpgradeStacks(playerId, 'defense_amp');
    return Math.max(0.1, 1 - stacks * 0.1);
  }

  public getMaxHealthBonus(playerId: string): number {
    const stacks = this.getUpgradeStacks(playerId, 'max_hp_amp');
    return stacks * 25;
  }

  public getWaveReached(): number {
    return this.currentWave;
  }

  private updateCombatPhase(simulation: WorldSimulation, deltaTime: number): void {
    const config = this.getScaledWaveConfig(this.currentWave);
    this.spawnAccumulator += deltaTime;

    while (this.spawnAccumulator >= config.spawnInterval && this.spawnedInWave < config.totalEnemies) {
      const aliveEnemies = simulation.enemies.getAliveEnemyCount();
      if (aliveEnemies >= config.maxAlive) break;

      this.spawnAccumulator -= config.spawnInterval;
      this.spawnEnemy(simulation, config);
    }

    const aliveEnemies = simulation.enemies.getAliveEnemyCount();
    if (this.spawnedInWave >= config.totalEnemies && aliveEnemies === 0) {
      this.onWaveCleared(simulation);
    }
  }

  private spawnEnemy(simulation: WorldSimulation, config: WaveConfig): void {
    const spawnPoint = this.pickSpawnPoint();
    const enemyId = `wave_${this.currentWave}_enemy_${this.spawnedInWave}_${this.randomSuffix()}`;

    const spawned = simulation.enemies.requestSpawnEnemy(enemyId, spawnPoint.clone());
    if (!spawned) return;

    this.spawnedInWave += 1;

    const pawn = simulation.enemies.getEnemyPawnById(enemyId);
    if (pawn) {
      const scalablePawn = pawn as typeof pawn & { maxHealth?: number };
      const baseHealth =
        typeof scalablePawn.maxHealth === 'number' ? scalablePawn.maxHealth : pawn.health;
      const scaledHealth = Math.max(1, Math.round(baseHealth * config.healthMultiplier));
      if (typeof scalablePawn.maxHealth === 'number') {
        scalablePawn.maxHealth = scaledHealth;
      }
      pawn.health = scaledHealth;
    }

    void config.damageMultiplier;
  }

  private onWaveCleared(simulation: WorldSimulation): void {
    this.queueWaveRespawns(simulation);

    if (this.currentWave >= WAVE_CONFIGS.length) {
      this.phase = 'ended';
      this.phaseTimeRemaining = 0;
      this.isFinished = true;
      this.queueWaveState(simulation);
      return;
    }

    this.phase = 'intermission';
    this.phaseTimeRemaining = this.intermissionDuration;
    this.spawnAccumulator = 0;
    this.queueWaveState(simulation);
  }

  private startUpgrade(simulation: WorldSimulation): void {
    this.phase = 'upgrade';
    this.phaseTimeRemaining = this.upgradeDuration;
    this.createUpgradeOffers();
    this.queueWaveState(simulation);
  }

  private startNextWaveOrEnd(simulation: WorldSimulation): void {
    const nextWave = this.currentWave + 1;
    if (nextWave > WAVE_CONFIGS.length) {
      this.phase = 'ended';
      this.phaseTimeRemaining = 0;
      this.isFinished = true;
      this.queueWaveState(simulation);
      return;
    }

    this.startWave(simulation, nextWave);
  }

  private startWave(simulation: WorldSimulation, waveNumber: number): void {
    this.currentWave = waveNumber;
    this.phase = 'combat';
    this.phaseTimeRemaining = 0;
    this.spawnedInWave = 0;
    this.spawnAccumulator = 0;
    this.queueWaveState(simulation);
  }

  private queueWaveRespawns(simulation: WorldSimulation): void {
    const respawnIds = Array.from(this.downedPlayers).filter((playerId) =>
      this.connectedPlayers.has(playerId)
    );

    for (const playerId of respawnIds) {
      const position = this.pickSafeRespawn(simulation);
      this.queuedRespawns.push({
        playerId,
        decision: {
          action: 'respawn',
          delay: this.waveRespawnDelaySeconds,
          position,
        },
      });
      this.downedPlayers.delete(playerId);
      this.alivePlayers.add(playerId);
    }
  }

  private pickSafeRespawn(simulation: WorldSimulation): { x: number; y: number; z: number } {
    const aliveEnemies = simulation.enemies.getEnemyStates().filter((enemy) => !enemy.isDead);
    if (aliveEnemies.length === 0) {
      const fallback = SAFE_RESPAWN_POINTS[0];
      return { x: fallback.x, y: fallback.y, z: fallback.z };
    }

    let bestPoint = SAFE_RESPAWN_POINTS[0];
    let bestMinDistance = Number.NEGATIVE_INFINITY;

    for (const point of SAFE_RESPAWN_POINTS) {
      let minDistance = Number.POSITIVE_INFINITY;
      for (const enemy of aliveEnemies) {
        const distance = Vector3.Distance(
          point,
          new Vector3(enemy.position.x, enemy.position.y, enemy.position.z)
        );
        minDistance = Math.min(minDistance, distance);
      }

      if (minDistance > bestMinDistance) {
        bestMinDistance = minDistance;
        bestPoint = point;
      }
    }

    return { x: bestPoint.x, y: bestPoint.y, z: bestPoint.z };
  }

  private queueWaveState(simulation: WorldSimulation): void {
    const waveState: WaveStatePayload = {
      wave: Math.max(1, this.currentWave || 1),
      phase: this.phase,
      remainingEnemies: simulation.enemies.getAliveEnemyCount(),
      timeRemaining: Math.max(0, this.phaseTimeRemaining),
      alivePlayers: this.alivePlayers.size,
      totalPlayers: this.connectedPlayers.size,
    };

    this.pendingWaveStateEvents.push(waveState);
  }

  private getScaledWaveConfig(waveNumber: number): WaveConfig {
    const base = WAVE_CONFIGS[Math.max(0, Math.min(waveNumber - 1, WAVE_CONFIGS.length - 1))];
    const playerScale = this.getPartyScale(this.connectedPlayers.size);

    return {
      totalEnemies: Math.max(1, Math.round(base.totalEnemies * playerScale)),
      maxAlive: Math.max(1, Math.round(base.maxAlive * playerScale)),
      spawnInterval: base.spawnInterval,
      healthMultiplier: base.healthMultiplier,
      damageMultiplier: base.damageMultiplier,
    };
  }

  private getPartyScale(playerCount: number): number {
    if (playerCount <= 1) return 0.55;
    if (playerCount === 2) return 0.75;
    if (playerCount === 3) return 0.9;
    return 1.0;
  }

  private pickSpawnPoint(): Vector3 {
    const index = Math.floor(this.randomSource() * ENEMY_SPAWN_POINTS.length);
    return ENEMY_SPAWN_POINTS[Math.max(0, Math.min(index, ENEMY_SPAWN_POINTS.length - 1))];
  }

  private randomSuffix(): string {
    return Math.floor(this.randomSource() * 1_000_000)
      .toString(36)
      .padStart(4, '0')
      .slice(0, 4);
  }

  private createUpgradeOffers(): void {
    this.pendingUpgradeOffers.clear();

    for (const playerId of this.connectedPlayers.values()) {
      const options = this.pickUpgradeOptions(3);
      const offer: UpgradeOfferPayload = {
        offerId: `offer_${this.currentWave}_${playerId}_${this.randomSuffix()}`,
        playerId,
        wave: this.currentWave,
        expiresInSeconds: this.upgradeDuration,
        options,
      };
      this.pendingUpgradeOffers.set(offer.offerId, offer);
      this.pendingUpgradeOfferEvents.push(offer);
    }
  }

  private finalizePendingUpgradeOffers(): void {
    const offers = Array.from(this.pendingUpgradeOffers.values());
    this.pendingUpgradeOffers.clear();

    for (const offer of offers) {
      const fallbackOption = offer.options[0];
      this.applyUpgrade(offer.playerId, offer.offerId, fallbackOption.id);
    }
  }

  private pickUpgradeOptions(count: number): UpgradeOfferPayload['options'] {
    const pool = [...UPGRADE_POOL];
    const selected: UpgradeOfferPayload['options'] = [];

    while (selected.length < count && pool.length > 0) {
      const index = Math.floor(this.randomSource() * pool.length);
      const clamped = Math.max(0, Math.min(index, pool.length - 1));
      const [picked] = pool.splice(clamped, 1);
      selected.push({
        id: picked.id,
        label: picked.label,
        description: picked.description,
        rarity: picked.rarity,
      });
    }

    return selected;
  }

  private applyUpgrade(playerId: string, offerId: string, upgradeId: string): UpgradeApplyPayload {
    const playerStacks = this.ensurePlayerStackMap(playerId);
    const nextStacks = (playerStacks.get(upgradeId) || 0) + 1;
    playerStacks.set(upgradeId, nextStacks);

    const payload: UpgradeApplyPayload = {
      playerId,
      offerId,
      upgradeId,
      stacks: nextStacks,
    };
    this.pendingUpgradeApplyEvents.push(payload);
    return payload;
  }

  private getUpgradeStacks(playerId: string, upgradeId: string): number {
    return this.playerUpgradeStacks.get(playerId)?.get(upgradeId) || 0;
  }

  private ensurePlayerStackMap(playerId: string): Map<string, number> {
    let stacks = this.playerUpgradeStacks.get(playerId);
    if (!stacks) {
      stacks = new Map<string, number>();
      this.playerUpgradeStacks.set(playerId, stacks);
    }
    return stacks;
  }

  private removePlayerUpgradeOffers(playerId: string): void {
    const entries = Array.from(this.pendingUpgradeOffers.entries());
    for (const [offerId, offer] of entries) {
      if (offer.playerId === playerId) {
        this.pendingUpgradeOffers.delete(offerId);
      }
    }
  }
}
