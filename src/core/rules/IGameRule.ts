import { PlayerPawn } from '../pawns/PlayerPawn';

/**
 * 게임의 승리/패배 조건 및 진행 규칙을 정의하는 인터페이스.
 * 새로운 게임 모드(타임 어택, 깃발 뺏기 등)를 추가할 때 이 인터페이스를 구현하여 교체합니다.
 */
export interface IGameRule {
  /** 규칙 초기화 (게임 시작 시 호출) */
  onStart(): void;

  /** 매 프레임 업데이트 */
  onUpdate(deltaTime: number): void;

  /** 플레이어 사망 시 호출 */
  onPlayerDied(player: PlayerPawn): void;

  /** 승리 조건 확인 (return true if won) */
  checkWinCondition(): boolean;

  /** 규칙 종료/정리 */
  dispose(): void;
}
