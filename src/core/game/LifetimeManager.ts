import { Observable, Observer } from '@babylonjs/core';
import { SimpleObservable, SimpleObserver } from '../../shared/utils/SimpleObservable';

type TrackedObserver =
  | { type: 'babylon'; observable: Observable<unknown>; observer: Observer<unknown> }
  | { type: 'simple'; observable: SimpleObservable<unknown>; observer: SimpleObserver<unknown> };

/**
 * 전역 또는 세션별 리소스를 관리하여 메모리 누수를 방지하는 매니저.
 * Observable의 Observer, Nanostores의 구독 해제 함수 등을 등록하여 한꺼번에 처리합니다.
 */
export class LifetimeManager {
  private observers: TrackedObserver[] = [];
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
  public trackObserver<T>(
    observable: Observable<T> | SimpleObservable<T>,
    observer: Observer<T> | SimpleObserver<T> | null
  ): void {
    if (!observer) return;

    if (observable instanceof Observable) {
      // It's a Babylon Observable, so observer MUST be Babylon Observer (or we cast safely if logic is correct)
      // JS runtime check: if observer has 'mask' or similar? Babylon Observer is a class.
      // Simple tactic: Force checking types or casting.
      this.observers.push({
        type: 'babylon',
        observable: observable as Observable<unknown>,
        observer: observer as Observer<unknown>,
      });
    } else if (observable instanceof SimpleObservable && observer instanceof SimpleObserver) {
      this.observers.push({
        type: 'simple',
        observable: observable as SimpleObservable<unknown>,
        observer: observer as SimpleObserver<unknown>,
      });
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
      if (item.type === 'babylon') {
        item.observable.remove(item.observer);
      } else {
        item.observable.remove(item.observer);
      }
    }
    this.observers = [];

    for (const unsub of this.unsubs) {
      unsub();
    }
    this.unsubs = [];
  }
}
