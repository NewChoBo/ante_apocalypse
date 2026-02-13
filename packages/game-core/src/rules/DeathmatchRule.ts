import { IGameRule, RespawnDecision, GameEndResult } from './IGameRule.js';
import { WorldSimulation } from '../simulation/WorldSimulation.js';

type RandomSource = () => number;

/**
 * 데스매치 모드: PvP, 리스폰 허용, 킬 수 기반 승리
 */
export class DeathmatchRule implements IGameRule {
  public readonly modeId = 'deathmatch';
  public readonly allowRespawn = true;
  public readonly respawnDelay = 3; // 3초 대기 후 리스폰

  private killCount: Map<string, number> = new Map();
  private readonly killTarget = 10; // 10킬 시 승리

  constructor(private readonly randomSource: RandomSource = Math.random) {}

  public onInitialize(_simulation: WorldSimulation): void {
    // 데스매치는 초기 스폰 없음 (플레이어만)
    this.killCount.clear();
  }

  public onUpdate(_simulation: WorldSimulation, _deltaTime: number): void {
    // 시간제한 등 추가 가능
  }

  public onPlayerJoin(_simulation: WorldSimulation, playerId: string): void {
    this.killCount.set(playerId, 0);
  }

  public onPlayerLeave(_simulation: WorldSimulation, playerId: string): void {
    this.killCount.delete(playerId);
  }

  public onPlayerDeath(
    _simulation: WorldSimulation,
    _playerId: string,
    killerId?: string
  ): RespawnDecision {
    // 킬러 점수 추가
    if (killerId && this.killCount.has(killerId)) {
      this.killCount.set(killerId, (this.killCount.get(killerId) || 0) + 1);
    }

    // 리스폰 위치 (랜덤 또는 스폰 포인트)
    const spawnPoints = [
      { x: 5, y: 1, z: 5 },
      { x: -5, y: 1, z: 5 },
      { x: 5, y: 1, z: -5 },
      { x: -5, y: 1, z: -5 },
    ];
    const randomIndex = Math.floor(this.randomSource() * spawnPoints.length);
    const clampedIndex = Math.max(0, Math.min(randomIndex, spawnPoints.length - 1));
    const randomSpawn = spawnPoints[clampedIndex];

    return {
      action: 'respawn',
      delay: this.respawnDelay,
      position: randomSpawn,
    };
  }

  public checkGameEnd(_simulation: WorldSimulation): GameEndResult | null {
    for (const [playerId, kills] of this.killCount.entries()) {
      if (kills >= this.killTarget) {
        return {
          winnerId: playerId,
          reason: `Reached ${this.killTarget} kills`,
        };
      }
    }
    return null;
  }

  /** 현재 킬 수 조회 */
  public getKillCount(playerId: string): number {
    return this.killCount.get(playerId) || 0;
  }
}
