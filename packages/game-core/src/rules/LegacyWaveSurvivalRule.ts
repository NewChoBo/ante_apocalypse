import { IGameRule, RespawnDecision, GameEndResult } from './IGameRule.js';
import { WorldSimulation } from '../simulation/WorldSimulation.js';

/**
 * Backward-compatible legacy survival rule used when survivalRuleset !== 'v2'.
 */
export class LegacyWaveSurvivalRule implements IGameRule {
  public readonly modeId = 'survival';
  public readonly allowRespawn = false;
  public readonly respawnDelay = 0;

  private alivePlayers: Set<string> = new Set();

  public onInitialize(simulation: WorldSimulation): void {
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
