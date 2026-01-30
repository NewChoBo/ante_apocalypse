/**
 * 매 프레임 업데이트가 필요한 객체를 위한 인터페이스.
 */
export interface ITickable {
  /**
   * 업데이트 로직 실행
   * @param deltaTime 프레임 간의 시간 간격 (초 단위)
   */
  tick(deltaTime: number): void;

  /**
   * 업데이트 우선순위 (낮을수록 먼저 실행)
   * 예: Controller(10) -> Pawn(20) -> UI/Other(30)
   */
  readonly priority: number;
}
