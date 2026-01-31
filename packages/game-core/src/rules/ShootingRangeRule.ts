import { IGameRule, RespawnDecision, GameEndResult } from './IGameRule.js';
import { WorldSimulation } from '../simulation/WorldSimulation.js';
import { Vector3 } from '@babylonjs/core';

/**
 * 사격장 모드: 연습용, 타겟만 스폰, 적 없음, 승패 조건 없음
 */
export class ShootingRangeRule implements IGameRule {
  public readonly modeId = 'shooting_range';
  public readonly allowRespawn = false;
  public readonly respawnDelay = 0;

  public onInitialize(simulation: WorldSimulation): void {
    // 타겟만 스폰 (적 없음)
    const distances = [10, 15, 20, 25, 30];

    for (let lane = 0; lane < 5; lane++) {
      const x = (lane - 2) * 5;
      distances.forEach((z) => {
        const isMoving = z >= 20; // 먼 거리는 이동 타겟
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
