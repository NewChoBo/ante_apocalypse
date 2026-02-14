import { describe, expect, it, vi } from 'vitest';
import { WorldSimulation } from './WorldSimulation.js';
import type { BaseEnemyManager } from '../systems/BaseEnemyManager.js';
import type { BasePickupManager } from '../systems/BasePickupManager.js';
import type { BaseTargetSpawner } from '../systems/BaseTargetSpawner.js';
import type { INetworkAuthority } from '../network/INetworkAuthority.js';
import type { IGameRule } from '../rules/IGameRule.js';

function createSimulationBundle(isMaster: boolean): {
  simulation: WorldSimulation;
  enemyUpdate: ReturnType<typeof vi.fn>;
  ruleUpdate: ReturnType<typeof vi.fn>;
} {
  const enemyUpdate = vi.fn();
  const ruleUpdate = vi.fn();

  const enemies = {
    update: enemyUpdate,
  } as unknown as BaseEnemyManager;
  const pickups = {} as BasePickupManager;
  const targets = {} as BaseTargetSpawner;
  const authority = {
    isMasterClient: (): boolean => isMaster,
  } as INetworkAuthority;

  const simulation = new WorldSimulation(enemies, pickups, targets, authority);
  simulation.setGameRule({
    modeId: 'survival',
    allowRespawn: false,
    respawnDelay: 0,
    onInitialize: (): void => undefined,
    onUpdate: (_sim, deltaTime): void => {
      ruleUpdate(deltaTime);
    },
    onPlayerJoin: (): void => undefined,
    onPlayerLeave: (): void => undefined,
    onPlayerDeath: (): { action: 'spectate' } => ({ action: 'spectate' }),
    checkGameEnd: (): null => null,
  } as IGameRule);

  return { simulation, enemyUpdate, ruleUpdate };
}

describe('WorldSimulation', () => {
  it('updates enemy manager and game rule on master authority', () => {
    const { simulation, enemyUpdate, ruleUpdate } = createSimulationBundle(true);

    simulation.update(0.16);

    expect(enemyUpdate).toHaveBeenCalledTimes(1);
    expect(enemyUpdate).toHaveBeenCalledWith(0.16);
    expect(ruleUpdate).toHaveBeenCalledTimes(1);
    expect(ruleUpdate).toHaveBeenCalledWith(0.16);
  });

  it('skips updates when authority is not master', () => {
    const { simulation, enemyUpdate, ruleUpdate } = createSimulationBundle(false);

    simulation.update(0.16);

    expect(enemyUpdate).not.toHaveBeenCalled();
    expect(ruleUpdate).not.toHaveBeenCalled();
  });
});
