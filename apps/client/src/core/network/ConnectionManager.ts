import { Observable } from '@babylonjs/core';
import { INetworkProvider } from './INetworkProvider';
import { NetworkState } from '@ante/common';

/**
 * 네트워크 연결 및 재연결 로직을 담당하는 클래스
 */
export class ConnectionManager {
  public currentState: NetworkState = NetworkState.Disconnected;
  public onStateChanged = new Observable<NetworkState>();

  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(private provider: INetworkProvider) {}

  /**
   * 네트워크 연결 시작
   */
  public async connect(userId: string): Promise<boolean> {
    // Prevent redundant connection attempts
    if (
      this.currentState !== NetworkState.Disconnected &&
      this.currentState !== NetworkState.Error
    ) {
      return false;
    }

    try {
      return await this.provider.connect(userId);
    } catch {
      // Connection failure handled via onStateChanged
      return false;
    }
  }

  /**
   * 네트워크 연결 해제
   */
  public disconnect(): void {
    this.clearReconnectTimer();
    this.provider.disconnect();
  }

  /**
   * Provider의 상태 변경을 처리
   */
  public handleStateChange(state: NetworkState): void {
    this.currentState = state;
    this.onStateChanged.notifyObservers(state);

    // Auto-reconnect logic
    if (state === NetworkState.Disconnected || state === NetworkState.Error) {
      this.scheduleReconnect();
    }
  }

  /**
   * 자동 재연결 스케줄링
   */
  private scheduleReconnect(): void {
    this.clearReconnectTimer();

    const userId = localStorage.getItem('playerName') || 'COMMANDER';

    this.reconnectTimeoutId = setTimeout((): void => {
      if (
        this.currentState === NetworkState.Disconnected ||
        this.currentState === NetworkState.Error
      ) {
        this.connect(userId);
      }
    }, 3000);
  }

  /**
   * 재연결 타이머 정리
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
  }

  /**
   * 리소스 정리
   */
  public dispose(): void {
    this.clearReconnectTimer();
    this.onStateChanged.clear();
  }
}
