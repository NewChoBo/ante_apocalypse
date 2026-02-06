import { Scene } from '@babylonjs/core';
import { IPawnCore } from '../../types/IPawnCore.js';
import { BaseComponent } from '../BaseComponent.js';

/**
 * 전이 규칙 타입 정의.
 */
export type TransitionMap<T extends string> = Record<T, T[]>;

/**
 * 클래스(Pawn)에 유한 상태 머신(FSM) 기능을 제공하는 컴포넌트.
 * Mixin을 대체하여 타입 안전성을 높입니다.
 */
export abstract class BaseFSMComponent<TState extends string> extends BaseComponent {
  private _currentState: TState;

  constructor(
    owner: IPawnCore,
    scene: Scene,
    private transitions: TransitionMap<TState>,
    initialState: TState
  ) {
    super(owner, scene);
    this._currentState = initialState;
  }

  public get currentState(): TState {
    return this._currentState;
  }

  /**
   * 특정 상태로 전이가 가능한지 확인합니다.
   */
  public canTransitionTo(nextState: TState): boolean {
    const allowed = this.transitions[this._currentState];
    return allowed ? allowed.includes(nextState) : false;
  }

  /**
   * 상태를 변경합니다. 규칙에 어긋나면 무시됩니다.
   */
  public transitionTo(nextState: TState): boolean {
    if (!this.canTransitionTo(nextState)) {
      return false;
    }

    const prevState = this._currentState;
    this._currentState = nextState;
    this.onStateChanged(nextState, prevState);
    return true;
  }

  /**
   * 상태 변경 후 호출되는 추상 메서드.
   */
  protected abstract onStateChanged(newState: TState, oldState: TState): void;

  public update(_deltaTime: number): void {
    // FSM 자체의 시간 기반 업데이트가 필요한 경우 사용
  }
}
