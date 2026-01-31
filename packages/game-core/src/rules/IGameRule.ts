import { WorldSimulation } from '../simulation/WorldSimulation.js';

/**
 * 리스폰 결정 타입
 */
export type RespawnDecision =
  | { action: 'respawn'; delay: number; position?: { x: number; y: number; z: number } }
  | { action: 'spectate' }
  | { action: 'kick' };

/**
 * 게임 종료 결과
 */
export interface GameEndResult {
  winnerId?: string;
  winnerTeam?: string;
  reason: string;
}

/**
 * 게임의 규칙(모드)을 정의하는 인터페이스.
 * 스폰, 승리 조건, 웨이브 관리 등을 담당한다.
 */
export interface IGameRule {
  /** 모드 식별자 */
  readonly modeId: string;

  /** 리스폰 허용 여부 */
  readonly allowRespawn: boolean;

  /** 리스폰 대기 시간 (초) */
  readonly respawnDelay: number;

  /**
   * 게임 시작 시 호출 (초기 스폰 등)
   */
  onInitialize(simulation: WorldSimulation): void;

  /**
   * 매 프레임 업데이트 (웨이브 체크 등)
   */
  onUpdate(simulation: WorldSimulation, deltaTime: number): void;

  /**
   * 플레이어 입장 시 호출
   */
  onPlayerJoin(simulation: WorldSimulation, playerId: string): void;

  /**
   * 플레이어 퇴장 시 호출
   */
  onPlayerLeave(simulation: WorldSimulation, playerId: string): void;

  /**
   * 플레이어 사망 시 처리 결정
   */
  onPlayerDeath(simulation: WorldSimulation, playerId: string, killerId?: string): RespawnDecision;

  /**
   * 게임 종료 조건 체크
   * @returns null이면 게임 계속, GameEndResult면 게임 종료
   */
  checkGameEnd(simulation: WorldSimulation): GameEndResult | null;
}
