import { IGameRule, RespawnDecision, GameEndResult } from './IGameRule.js';
import { WorldSimulation } from '../simulation/WorldSimulation.js';

/**
 * 사격장 모드: 연습용, 타겟만 스폰, 적 없음, 승패 조건 없음
 */
export class ShootingRangeRule implements IGameRule {
  public readonly modeId = 'shooting_range';
  public readonly allowRespawn = false;
  public readonly respawnDelay = 0;

  public onInitialize(simulation: WorldSimulation): void {
    // Target gameplay has been removed. Keep the mode alive by spawning lightweight enemy dummies.
    simulation.enemies.spawnEnemiesAt([
      [0, 0, 10],
      [6, 0, 14],
      [-6, 0, 14],
    ]);
  }

  public onUpdate(_simulation: WorldSimulation, _deltaTime: number): void {
    // 점수 계산 등 필요시 추가
  }

  public onPlayerJoin(_simulation: WorldSimulation, _playerId: string): void {
    // 사격장은 특별한 처리 없음
  }

  public onPlayerLeave(_simulation: WorldSimulation, _playerId: string): void {
    // 사격장은 특별한 처리 없음
  }

  public onPlayerDeath(
    _simulation: WorldSimulation,
    _playerId: string,
    _killerId?: string
  ): RespawnDecision {
    // 사격장에서는 사망하지 않음 (혹시 발생하면 무시)
    return { action: 'spectate' };
  }

  public checkGameEnd(_simulation: WorldSimulation): GameEndResult | null {
    // 사격장은 종료 조건 없음
    return null;
  }
}
