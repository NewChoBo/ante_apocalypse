import { WorldSimulation } from '../simulation/WorldSimulation.js';

/**
 * 게임의 규칙(모드)을 정의하는 인터페이스.
 * 스폰, 승리 조건, 웨이브 관리 등을 담당한다.
 */
export interface IGameRule {
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
}
