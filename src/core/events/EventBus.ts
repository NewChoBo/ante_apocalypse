import { IEventBus, EventMap, EventCallback } from '../../types/IEventBus.ts';

/**
 * 프로젝트 전체에서 사용될 중앙 메시지 버스 구현체.
 * 싱글톤 패턴으로 구현하여 어디서든 접근 가능하게 합니다.
 */
export class EventBus implements IEventBus {
  private static instance: EventBus;
  private listeners: Map<keyof EventMap, EventCallback<any>[]> = new Map();

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public on<K extends keyof EventMap>(eventName: K, callback: EventCallback<K>): void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName)!.push(callback);
  }

  public once<K extends keyof EventMap>(eventName: K, callback: EventCallback<K>): void {
    const wrapper: EventCallback<K> = (data) => {
      callback(data);
      this.off(eventName, wrapper);
    };
    this.on(eventName, wrapper);
  }

  public emit<K extends keyof EventMap>(eventName: K, data: EventMap[K]): void {
    console.debug(`[EventBus] ${eventName as string}`, data);
    const eventListeners = this.listeners.get(eventName);
    if (eventListeners) {
      eventListeners.forEach((callback) => callback(data));
    }
  }

  public off<K extends keyof EventMap>(eventName: K, callback: EventCallback<K>): void {
    const eventListeners = this.listeners.get(eventName);
    if (eventListeners) {
      this.listeners.set(
        eventName,
        eventListeners.filter((listener) => listener !== callback)
      );
    }
  }
}

/** 외부에서 편리하게 접근하기 위한 export */
export const eventBus = EventBus.getInstance();
