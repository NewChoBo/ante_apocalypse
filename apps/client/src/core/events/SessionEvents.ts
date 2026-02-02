import { Observable } from '@babylonjs/core';
import { Logger } from '@ante/common';
import { StateTransitionEvent } from '../systems/SessionStateMachine';

const logger = new Logger('SessionEvents');

/**
 * 세션 레벨 이벤트 타입들
 */
export interface SessionErrorEvent {
  type: 'NETWORK' | 'STATE' | 'SYSTEM' | 'UNKNOWN';
  message: string;
  error?: Error;
  timestamp: number;
  recoverable: boolean;
}

export interface NetworkErrorEvent {
  code: number;
  message: string;
  timestamp: number;
  retryable: boolean;
}

export interface SystemErrorEvent {
  system: string;
  operation: string;
  error: Error;
  timestamp: number;
}

export interface SessionLifecycleEvent {
  phase: 'INIT' | 'CONNECT' | 'LOAD' | 'PLAY' | 'DISCONNECT' | 'DISPOSE';
  status: 'STARTED' | 'COMPLETED' | 'FAILED';
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface PlayerActionEvent {
  playerId: string;
  action: 'JOIN' | 'LEAVE' | 'RESPAWN' | 'DEATH';
  timestamp: number;
  data?: Record<string, unknown>;
}

/**
 * 세션 이벤트 버스
 * 세션 관련 모든 이벤트의 중앙 집중식 발행/구독 시스템
 */
export class SessionEvents {
  // 싱글톤 인스턴스
  private static instance: SessionEvents;

  // 상태 변경 이벤트
  public readonly onStateChanged = new Observable<StateTransitionEvent>();

  // 에러 이벤트
  public readonly onSessionError = new Observable<SessionErrorEvent>();
  public readonly onNetworkError = new Observable<NetworkErrorEvent>();
  public readonly onSystemError = new Observable<SystemErrorEvent>();

  // 라이프사이클 이벤트
  public readonly onLifecycle = new Observable<SessionLifecycleEvent>();

  // 플레이어 액션 이벤트
  public readonly onPlayerAction = new Observable<PlayerActionEvent>();

  // 초기화 완료 이벤트
  public readonly onInitialized = new Observable<{ timestamp: number }>();

  // 연결 상태 이벤트
  public readonly onConnectionStatus = new Observable<{
    connected: boolean;
    timestamp: number;
    reason?: string;
  }>();

  // 디스포즈 이벤트
  public readonly onDisposed = new Observable<{ timestamp: number }>();

  private constructor() {
    // 싱글톤 패턴
  }

  public static getInstance(): SessionEvents {
    if (!SessionEvents.instance) {
      SessionEvents.instance = new SessionEvents();
    }
    return SessionEvents.instance;
  }

  /**
   * 세션 에러 발행
   */
  public emitSessionError(
    type: SessionErrorEvent['type'],
    message: string,
    error?: Error,
    recoverable: boolean = false
  ): void {
    const event: SessionErrorEvent = {
      type,
      message,
      error,
      timestamp: Date.now(),
      recoverable,
    };
    logger.error(`Session Error [${type}]: ${message}`, error);
    this.onSessionError.notifyObservers(event);
  }

  /**
   * 네트워크 에러 발행
   */
  public emitNetworkError(code: number, message: string, retryable: boolean = true): void {
    const event: NetworkErrorEvent = {
      code,
      message,
      timestamp: Date.now(),
      retryable,
    };
    logger.error(`Network Error [${code}]: ${message}`);
    this.onNetworkError.notifyObservers(event);
  }

  /**
   * 시스템 에러 발행
   */
  public emitSystemError(system: string, operation: string, error: Error): void {
    const event: SystemErrorEvent = {
      system,
      operation,
      error,
      timestamp: Date.now(),
    };
    logger.error(`System Error [${system}.${operation}]:`, error);
    this.onSystemError.notifyObservers(event);
  }

  /**
   * 라이프사이클 이벤트 발행
   */
  public emitLifecycle(
    phase: SessionLifecycleEvent['phase'],
    status: SessionLifecycleEvent['status'],
    metadata?: Record<string, unknown>
  ): void {
    const event: SessionLifecycleEvent = {
      phase,
      status,
      timestamp: Date.now(),
      metadata,
    };
    logger.info(`Lifecycle [${phase}]: ${status}`);
    this.onLifecycle.notifyObservers(event);
  }

  /**
   * 플레이어 액션 이벤트 발행
   */
  public emitPlayerAction(
    playerId: string,
    action: PlayerActionEvent['action'],
    data?: Record<string, unknown>
  ): void {
    const event: PlayerActionEvent = {
      playerId,
      action,
      timestamp: Date.now(),
      data,
    };
    logger.debug(`Player Action [${playerId}]: ${action}`);
    this.onPlayerAction.notifyObservers(event);
  }

  /**
   * 연결 상태 이벤트 발행
   */
  public emitConnectionStatus(connected: boolean, reason?: string): void {
    this.onConnectionStatus.notifyObservers({
      connected,
      timestamp: Date.now(),
      reason,
    });
  }

  /**
   * 초기화 완료 이벤트 발행
   */
  public emitInitialized(): void {
    this.onInitialized.notifyObservers({ timestamp: Date.now() });
  }

  /**
   * 디스포즈 이벤트 발행
   */
  public emitDisposed(): void {
    this.onDisposed.notifyObservers({ timestamp: Date.now() });
  }

  /**
   * 모든 옵저버 정리
   */
  public clearAllObservers(): void {
    this.onStateChanged.clear();
    this.onSessionError.clear();
    this.onNetworkError.clear();
    this.onSystemError.clear();
    this.onLifecycle.clear();
    this.onPlayerAction.clear();
    this.onInitialized.clear();
    this.onConnectionStatus.clear();
    this.onDisposed.clear();
    logger.info('All session event observers cleared');
  }

  /**
   * 에러 관련 옵저버만 정리
   */
  public clearErrorObservers(): void {
    this.onSessionError.clear();
    this.onNetworkError.clear();
    this.onSystemError.clear();
  }
}

// 편의를 위한 전역 인스턴스 낵스포트
export const sessionEvents = SessionEvents.getInstance();
