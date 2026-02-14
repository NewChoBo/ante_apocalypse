import { IGameRule, RespawnDecision, GameEndResult } from './IGameRule.js';
import { WorldSimulation } from '../simulation/WorldSimulation.js';
import { Vector3 } from '@babylonjs/core';

/**
 * Backward-compatible legacy survival rule used when survivalRuleset !== 'v2'.
 */
export class LegacyWaveSurvivalRule implements IGameRule {
  public readonly modeId = 'survival';
  public readonly allowRespawn = false;
  public readonly respawnDelay = 0;

  private alivePlayers: Set<string> = new Set();

  public onInitialize(simulation: WorldSimulation): void {
    const distances = [10, 15, 20];

    for (let lane = 0; lane < 5; lane++) {
      const x = (lane - 2) * 7;
      distances.forEach((z) => {
        const isMoving = Math.random() > 0.5;
        const position = new Vector3(x, 1.0, z);
        const id = `target_${lane}_${z}_${Math.random().toString(36).substr(2, 4)}`;

        simulation.targets.spawnTargetAt(
          id,
          isMoving ? 'moving_target' : 'static_target',
          position,
          isMoving
        );
      });
    }

    simulation.enemies.spawnEnemiesAt([
      [5, 0, 5],
      [-5, 0, 5],
    ]);
  }

  public onUpdate(_simulation: WorldSimulation, _deltaTime: number): void {
    // Legacy rule keeps previous lightweight behavior.
  }

  public onPlayerJoin(_simulation: WorldSimulation, playerId: string): void {
    this.alivePlayers.add(playerId);
  }

  public onPlayerLeave(_simulation: WorldSimulation, playerId: string): void {
    this.alivePlayers.delete(playerId);
  }

  public onPlayerDeath(
    _simulation: WorldSimulation,
    playerId: string,
    _killerId?: string
  ): RespawnDecision {
    this.alivePlayers.delete(playerId);
    return { action: 'spectate' };
  }

  public checkGameEnd(_simulation: WorldSimulation): GameEndResult | null {
    if (this.alivePlayers.size === 0) {
      return { reason: 'All players eliminated' };
    }
    return null;
  }
}
