/**
 * 유한 상태 머신(FSM)의 상태 전이 규칙 타입.
 */
export type TransitionMap<T extends string> = Record<T, T[]>;

/**
 * 타입 안전한 상태 머신 유틸리티 클래스.
 * Mixin을 대체하여 컴포지션 방식으로 사용됩니다.
 */
export class StateMachine<T extends string> {
  private _currentState: T;

  constructor(
    private transitions: TransitionMap<T>,
    initialState: T,
    private onStateChanged?: (newState: T, oldState: T) => void
  ) {
    this._currentState = initialState;
  }

  public get currentState(): T {
    return this._currentState;
  }

  /**
   * 상태 전이가 가능한지 확인합니다.
   */
  public canTransitionTo(nextState: T): boolean {
    const allowed = this.transitions[this._currentState];
    return allowed ? allowed.includes(nextState) : false;
  }

  /**
   * 상태를 변경합니다. 규칙에 어긋나면 false를 반환합니다.
   */
  public transitionTo(nextState: T): boolean {
    if (!this.canTransitionTo(nextState)) {
      return false;
    }

    const prevState = this._currentState;
    this._currentState = nextState;

    if (this.onStateChanged) {
      this.onStateChanged(nextState, prevState);
    }

    return true;
  }
}
