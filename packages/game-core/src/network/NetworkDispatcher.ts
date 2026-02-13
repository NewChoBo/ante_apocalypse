import { Logger, NetworkEventMap, EventCode } from '@ante/common';

const logger = new Logger('NetworkDispatcher');

export type NetworkHandler<K extends EventCode = EventCode> = (
  data: NetworkEventMap[K],
  senderId: string
) => void;

/**
 * 네트워크 이벤트 디스패처.
 * EventCode와 핸들러를 매핑하여 중앙 집중식으로 이벤트를 처리합니다.
 */
export class NetworkDispatcher {
  private handlers: Map<EventCode, NetworkHandler[]> = new Map();

  /**
   * 특정 이벤트 코드에 대한 핸들러 등록
   */
  public register<K extends EventCode>(code: K, handler: NetworkHandler<K>): void {
    if (!this.handlers.has(code)) {
      this.handlers.set(code, []);
    }
    this.handlers.get(code)!.push(handler as NetworkHandler);
  }

  /**
   * 특정 이벤트 코드에 대한 모든 핸들러 제거
   */
  public unregister(code: EventCode): void {
    this.handlers.delete(code);
  }

  /**
   * 수신된 이벤트 실행
   */
  public dispatch<K extends EventCode>(code: K, data: NetworkEventMap[K], senderId: string): void {
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
