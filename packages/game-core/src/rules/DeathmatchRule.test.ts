import { describe, expect, it } from 'vitest';
import { DeathmatchRule } from './DeathmatchRule.js';
import { WorldSimulation } from '../simulation/WorldSimulation.js';

function createSimulation(): WorldSimulation {
  return {} as WorldSimulation;
}

describe('DeathmatchRule', () => {
  it('uses injected random source for deterministic respawn selection', () => {
    const firstSpawnRule = new DeathmatchRule(() => 0);
    const lastSpawnRule = new DeathmatchRule(() => 0.9999);

    const firstDecision = firstSpawnRule.onPlayerDeath(createSimulation(), 'playerA');
    const lastDecision = lastSpawnRule.onPlayerDeath(createSimulation(), 'playerA');

    expect(firstDecision).toMatchObject({
      action: 'respawn',
      delay: 3,
      position: { x: 5, y: 1, z: 5 },
    });
    expect(lastDecision).toMatchObject({
      action: 'respawn',
      delay: 3,
      position: { x: -5, y: 1, z: -5 },
    });
  });

  it('increments only joined killer score and ends game at kill target', () => {
    const rule = new DeathmatchRule(() => 0);
    const simulation = createSimulation();

    rule.onInitialize(simulation);
    rule.onPlayerJoin(simulation, 'killer');

    for (let i = 0; i < 10; i++) {
      rule.onPlayerDeath(simulation, 'victim', 'killer');
    }

    expect(rule.getKillCount('killer')).toBe(10);
    expect(rule.checkGameEnd(simulation)).toMatchObject({
      winnerId: 'killer',
      reason: 'Reached 10 kills',
    });

    rule.onPlayerDeath(simulation, 'victim', 'non_joined');
    expect(rule.getKillCount('killer')).toBe(10);
  });
});
