import { Logger } from '@ante/common';

const logger = new Logger('NetworkDispatcher');

export type NetworkHandler<T = unknown> = (data: T, senderId: string) => void;

/**
 * 네트워크 이벤트 디스패처.
 * EventCode와 핸들러를 매핑하여 중앙 집중식으로 이벤트를 처리합니다.
 */
export class NetworkDispatcher {
  private handlers: Map<number, NetworkHandler[]> = new Map();

  /**
   * 특정 이벤트 코드에 대한 핸들러 등록
   */
  public register(code: number, handler: NetworkHandler): void {
    if (!this.handlers.has(code)) {
      this.handlers.set(code, []);
    }
    this.handlers.get(code)!.push(handler);
  }

  /**
   * 특정 이벤트 코드에 대한 모든 핸들러 제거
   */
  public unregister(code: number): void {
    this.handlers.delete(code);
  }

  /**
   * 수신된 이벤트 실행
   */
  public dispatch(code: number, data: unknown, senderId: string): void {
    const codeHandlers = this.handlers.get(code);
    if (codeHandlers) {
      codeHandlers.forEach((handler) => {
        try {
          handler(data, senderId);
        } catch (error) {
          logger.error(`Error in handler for event ${code}:`, error);
        }
      });
    }
  }

  /**
   * 모든 핸들러 제거
   */
  public clear(): void {
    this.handlers.clear();
  }
}
