import { Vector3 } from '@babylonjs/core';
import { describe, expect, it } from 'vitest';
import { WaveSurvivalRule } from './WaveSurvivalRule.js';
import { WorldSimulation } from '../simulation/WorldSimulation.js';

type EnemyPawnStub = {
  id: string;
  position: Vector3;
  rotation: Vector3;
  health: number;
  maxHealth: number;
  isDead: boolean;
  damageProfile?: {
    multipliers: Record<string, number>;
    defaultMultiplier: number;
  };
};

class EnemyManagerStub {
  private pawns = new Map<string, EnemyPawnStub>();

  public requestSpawnEnemy(id: string, position: Vector3): boolean {
    if (this.pawns.has(id)) return false;
    this.pawns.set(id, {
      id,
      position: position.clone(),
      rotation: Vector3.Zero(),
      health: 100,
      maxHealth: 100,
      isDead: false,
    });
    return true;
  }

  public getEnemyPawnById(id: string): EnemyPawnStub | undefined {
    return this.pawns.get(id);
  }

  public getAliveEnemyCount(): number {
    let alive = 0;
    this.pawns.forEach((pawn) => {
      if (!pawn.isDead) {
        alive++;
      }
    });
    return alive;
  }

  public getEnemyStates(): Array<{
    id: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    health: number;
    isDead: boolean;
  }> {
    return Array.from(this.pawns.values()).map((pawn) => ({
      id: pawn.id,
      position: { x: pawn.position.x, y: pawn.position.y, z: pawn.position.z },
      rotation: { x: pawn.rotation.x, y: pawn.rotation.y, z: pawn.rotation.z },
      health: pawn.health,
      isDead: pawn.isDead,
    }));
  }

  public killAllAlive(): void {
    this.pawns.forEach((pawn) => {
      pawn.isDead = true;
      pawn.health = 0;
    });
  }
}

function createSimulation(enemies: EnemyManagerStub): WorldSimulation {
  return {
    enemies,
    pickups: {},
    targets: {},
  } as unknown as WorldSimulation;
}

function advance(rule: WaveSurvivalRule, simulation: WorldSimulation, seconds: number, step = 0.1): void {
  let time = 0;
  while (time < seconds) {
    const delta = Math.min(step, seconds - time);
    rule.onUpdate(simulation, delta);
    time += delta;
  }
}

describe('WaveSurvivalRule', () => {
  it('transitions through warmup to combat and then intermission after wave clear', () => {
    const enemies = new EnemyManagerStub();
    const simulation = createSimulation(enemies);
    const rule = new WaveSurvivalRule(() => 0);

    rule.onPlayerJoin(simulation, 'p1');
    rule.onInitialize(simulation);

    advance(rule, simulation, 20.1);
    const phaseEventsAfterWarmup = rule.consumeWaveStateEvents();
    expect(phaseEventsAfterWarmup.some((event) => event.phase === 'combat' && event.wave === 1)).toBe(
      true
    );

    let reachedIntermission = false;
    for (let i = 0; i < 20; i++) {
      advance(rule, simulation, 2.1);
      enemies.killAllAlive();
      advance(rule, simulation, 0.1);

      const phaseEvents = rule.consumeWaveStateEvents();
      if (phaseEvents.some((event) => event.phase === 'intermission')) {
        reachedIntermission = true;
        break;
      }
    }

    expect(reachedIntermission).toBe(true);
  });

  it('ends the game when all connected players are eliminated', () => {
    const enemies = new EnemyManagerStub();
    const simulation = createSimulation(enemies);
    const rule = new WaveSurvivalRule(() => 0);

    rule.onPlayerJoin(simulation, 'p1');
    rule.onInitialize(simulation);
    rule.onPlayerDeath(simulation, 'p1');

    expect(rule.checkGameEnd(simulation)).toEqual({ reason: 'All players eliminated' });
  });

  it('queues wave-end respawns for downed players', () => {
    const enemies = new EnemyManagerStub();
    const simulation = createSimulation(enemies);
    const rule = new WaveSurvivalRule(() => 0);

    rule.onPlayerJoin(simulation, 'p1');
    rule.onPlayerJoin(simulation, 'p2');
    rule.onInitialize(simulation);

    advance(rule, simulation, 20.1);
    rule.consumeWaveStateEvents();

    rule.onPlayerDeath(simulation, 'p2');

    let queuedRespawnFound = false;
    for (let i = 0; i < 20; i++) {
      advance(rule, simulation, 2.1);
      enemies.killAllAlive();
      advance(rule, simulation, 0.1);

      const queuedRespawns = rule.consumeQueuedRespawns();
      if (queuedRespawns.some((respawn) => respawn.playerId === 'p2' && respawn.decision.delay === 3)) {
        queuedRespawnFound = true;
        break;
      }
    }

    expect(queuedRespawnFound).toBe(true);
    expect(rule.checkGameEnd(simulation)).toBeNull();
  });

  it('emits upgrade offers and applies selected upgrade stacks', () => {
    const enemies = new EnemyManagerStub();
    const simulation = createSimulation(enemies);
    const rule = new WaveSurvivalRule(() => 0);

    rule.onPlayerJoin(simulation, 'p1');
    rule.onInitialize(simulation);

    advance(rule, simulation, 20.1); // warmup -> combat

    let reachedIntermission = false;
    for (let i = 0; i < 20; i++) {
      advance(rule, simulation, 2.1);
      enemies.killAllAlive();
      advance(rule, simulation, 0.1);

      const phaseEvents = rule.consumeWaveStateEvents();
      if (phaseEvents.some((event) => event.phase === 'intermission')) {
        reachedIntermission = true;
        break;
      }
    }
    expect(reachedIntermission).toBe(true);

    advance(rule, simulation, 20.1); // intermission -> upgrade
    const offers = rule.consumeUpgradeOfferEvents();
    expect(offers).toHaveLength(1);
    expect(offers[0].playerId).toBe('p1');
    expect(offers[0].options.length).toBeGreaterThan(0);

    const selectedUpgrade = offers[0].options[0].id;
    const applied = rule.pickUpgrade('p1', offers[0].offerId, selectedUpgrade);
    expect(applied).not.toBeNull();
    expect(applied?.upgradeId).toBe(selectedUpgrade);
    expect(applied?.stacks).toBe(1);

    const appliedEvents = rule.consumeUpgradeApplyEvents();
    expect(appliedEvents).toHaveLength(1);

    if (selectedUpgrade === 'damage_amp') {
      expect(rule.getDamageMultiplier('p1')).toBeGreaterThan(1);
    }
    if (selectedUpgrade === 'defense_amp') {
      expect(rule.getDefenseMultiplier('p1')).toBeLessThan(1);
    }
    if (selectedUpgrade === 'max_hp_amp') {
      expect(rule.getMaxHealthBonus('p1')).toBe(25);
    }
  });
});
