import { Observable, Observer } from '@babylonjs/core';

/**
 * 전역 또는 세션별 리소스를 관리하여 메모리 누수를 방지하는 매니저.
 * Observable의 Observer, Nanostores의 구독 해제 함수 등을 등록하여 한꺼번에 처리합니다.
 */
export class LifetimeManager {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private observers: Array<{ observable: Observable<any>; observer: Observer<any> }> = [];
  private unsubs: Array<() => void> = [];

  /**
   * 전역 싱글톤 인스턴스 (필요에 따라 세션마다 별도 생성 가능)
   */
  private static instance: LifetimeManager;
  public static getInstance(): LifetimeManager {
    if (!LifetimeManager.instance) {
      LifetimeManager.instance = new LifetimeManager();
    }
    return LifetimeManager.instance;
  }

  /**
   * Observable의 Observer를 등록합니다.
   */
  public trackObserver<T>(observable: Observable<T>, observer: Observer<T> | null): void {
    if (observer) {
      this.observers.push({ observable, observer });
    }
  }

  /**
   * Nanostores subscribe() 시 반환되는 해제 함수 등을 등록합니다.
   */
  public trackUnsub(unsub: () => void): void {
    this.unsubs.push(unsub);
  }

  /**
   * 등록된 모든 리소스를 해제합니다.
   */
  public dispose(): void {
    console.log(
      `[LifetimeManager] Disposing ${this.observers.length} observers and ${this.unsubs.length} unsubs.`
    );

    for (const item of this.observers) {
      item.observable.remove(item.observer);
    }
    this.observers = [];

    for (const unsub of this.unsubs) {
      unsub();
    }
    this.unsubs = [];
  }
}
