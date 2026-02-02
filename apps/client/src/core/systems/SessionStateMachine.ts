import { Observable } from '@babylonjs/core';
import { Logger } from '@ante/common';

const logger = new Logger('SessionStateMachine');

/**
 * 세션 상태 열거형
 */
export enum SessionState {
  IDLE = 'IDLE',
  INITIALIZING = 'INITIALIZING',
  CONNECTING = 'CONNECTING',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  SPECTATING = 'SPECTATING',
  DISCONNECTING = 'DISCONNECTING',
  DISPOSED = 'DISPOSED',
  ERROR = 'ERROR',
}

/**
 * 상태 전환 이벤트 타입
 */
export interface StateTransitionEvent {
  from: SessionState;
  to: SessionState;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * 상태 전환 에러 타입
 */
export class StateTransitionError extends Error {
  constructor(
    public readonly from: SessionState,
    public readonly to: SessionState,
    public readonly reason: string
  ) {
    super(`Invalid state transition from ${from} to ${to}: ${reason}`);
    this.name = 'StateTransitionError';
  }
}

/**
 * 유효한 상태 전환 맵
 * 키: 현재 상태, 값: 유효한 다음 상태들
 */
const VALID_TRANSITIONS: Record<SessionState, SessionState[]> = {
  [SessionState.IDLE]: [SessionState.INITIALIZING, SessionState.DISPOSED, SessionState.ERROR],
  [SessionState.INITIALIZING]: [SessionState.CONNECTING, SessionState.DISPOSED, SessionState.ERROR],
  [SessionState.CONNECTING]: [SessionState.LOADING, SessionState.DISCONNECTING, SessionState.ERROR],
  [SessionState.LOADING]: [SessionState.PLAYING, SessionState.DISCONNECTING, SessionState.ERROR],
  [SessionState.PLAYING]: [
    SessionState.PAUSED,
    SessionState.SPECTATING,
    SessionState.DISCONNECTING,
    SessionState.ERROR,
  ],
  [SessionState.PAUSED]: [SessionState.PLAYING, SessionState.DISCONNECTING, SessionState.ERROR],
  [SessionState.SPECTATING]: [SessionState.PLAYING, SessionState.DISCONNECTING, SessionState.ERROR],
  [SessionState.DISCONNECTING]: [SessionState.IDLE, SessionState.DISPOSED, SessionState.ERROR],
  [SessionState.DISPOSED]: [], // 종료 상태에서는 전환 불가
  [SessionState.ERROR]: [SessionState.IDLE, SessionState.DISPOSED],
};

/**
 * 세션 상태 머신
 * 상태 전환의 유효성을 검증하고 이벤트를 발행합니다.
 */
export class SessionStateMachine {
  private currentState: SessionState = SessionState.IDLE;
  private stateHistory: StateTransitionEvent[] = [];
  private maxHistorySize = 50;

  // 상태 변경 Observable
  public readonly onStateChanged = new Observable<StateTransitionEvent>();
  public readonly onError = new Observable<StateTransitionError>();

  /**
   * 현재 상태 반환
   */
  public get state(): SessionState {
    return this.currentState;
  }

  /**
   * 상태 전환 이력 반환 (복사본)
   */
  public get history(): ReadonlyArray<StateTransitionEvent> {
    return [...this.stateHistory];
  }

  /**
   * 특정 상태로 전환
   * @param newState 목표 상태
   * @param metadata 추가 메타데이터
   * @throws StateTransitionError 유효하지 않은 전환 시
   */
  public transitionTo(newState: SessionState, metadata?: Record<string, unknown>): void {
    if (this.currentState === newState) {
      logger.debug(`Already in state ${newState}, skipping transition`);
      return;
    }

    if (!this.canTransitionTo(newState)) {
      const error = new StateTransitionError(
        this.currentState,
        newState,
        `Transition not allowed from ${this.currentState} to ${newState}`
      );
      this.onError.notifyObservers(error);
      throw error;
    }

    const event: StateTransitionEvent = {
      from: this.currentState,
      to: newState,
      timestamp: Date.now(),
      metadata,
    };

    logger.info(`State transition: ${this.currentState} -> ${newState}`);

    this.currentState = newState;
    this.addToHistory(event);
    this.onStateChanged.notifyObservers(event);
  }

  /**
   * 특정 상태로의 전환이 가능한지 확인
   */
  public canTransitionTo(state: SessionState): boolean {
    if (this.currentState === state) return true;
    return VALID_TRANSITIONS[this.currentState]?.includes(state) ?? false;
  }

  /**
   * 현재 상태가 지정된 상태들 중 하나인지 확인
   */
  public isInState(...states: SessionState[]): boolean {
    return states.includes(this.currentState);
  }

  /**
   * 특정 상태로 강제 전환 (유효성 검증 무시)
   * 오류 복구나 긴급 상황에서만 사용
   */
  public forceTransitionTo(newState: SessionState, metadata?: Record<string, unknown>): void {
    logger.warn(`Force transition: ${this.currentState} -> ${newState}`);

    const event: StateTransitionEvent = {
      from: this.currentState,
      to: newState,
      timestamp: Date.now(),
      metadata: { ...metadata, forced: true },
    };

    this.currentState = newState;
    this.addToHistory(event);
    this.onStateChanged.notifyObservers(event);
  }

  /**
   * 에러 상태로 전환
   */
  public transitionToError(reason: string, metadata?: Record<string, unknown>): void {
    logger.error(`Transitioning to ERROR state: ${reason}`);
    this.forceTransitionTo(SessionState.ERROR, { reason, ...metadata });
  }

  /**
   * 상태 머신 초기화
   */
  public reset(): void {
    logger.info('Resetting state machine');
    this.currentState = SessionState.IDLE;
    this.stateHistory = [];
  }

  /**
   * 상태 머신 정리
   */
  public dispose(): void {
    logger.info('Disposing state machine');
    this.currentState = SessionState.DISPOSED;
    this.stateHistory = [];
    this.onStateChanged.clear();
    this.onError.clear();
  }

  private addToHistory(event: StateTransitionEvent): void {
    this.stateHistory.push(event);
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }
  }
}
