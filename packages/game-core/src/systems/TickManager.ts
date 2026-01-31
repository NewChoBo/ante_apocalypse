import { ITickable } from '../types/ITickable.js';

/**
 * 게임 내 모든 ITickable 객체를 관리하고 매 프레임 업데이트를 수행하는 매니저.
 */
export class TickManager {
  private static instance: TickManager;
  private tickables: ITickable[] = [];
  private isTicking: boolean = false;
  private pendingAdditions: ITickable[] = [];
  private pendingRemovals: ITickable[] = [];

  private constructor() {}

  public static getInstance(): TickManager {
    if (!TickManager.instance) {
      TickManager.instance = new TickManager();
    }
    return TickManager.instance;
  }

  /** 업데이트 대상 등록 */
  public register(tickable: ITickable): void {
    if (this.isTicking) {
      if (!this.pendingAdditions.includes(tickable) && !this.tickables.includes(tickable)) {
        this.pendingAdditions.push(tickable);
      }
      return;
    }
    this.registerImmediate(tickable);
  }

  private registerImmediate(tickable: ITickable): void {
    if (this.tickables.includes(tickable)) return;
    this.tickables.push(tickable);
    this.tickables.sort((a, b) => a.priority - b.priority);
  }

  /** 업데이트 대상 해제 */
  public unregister(tickable: ITickable): void {
    if (this.isTicking) {
      if (!this.pendingRemovals.includes(tickable) && this.tickables.includes(tickable)) {
        this.pendingRemovals.push(tickable);
      }
      return;
    }
    this.unregisterImmediate(tickable);
  }

  private unregisterImmediate(tickable: ITickable): void {
    const index = this.tickables.indexOf(tickable);
    if (index !== -1) {
      this.tickables.splice(index, 1);
    }
  }

  /** 등록된 모든 객체 업데이트 실행 */
  public tick(deltaTime: number): void {
    this.isTicking = true;
    for (const tickable of this.tickables) {
      // 혹시 pendingRemoval에 있으면 스킵?
      // 아니요, tick 도중 unregister된 것은 그 프레임에는 실행해주는게 보통이거나,
      // 아니면 즉시 중단이 맞을 수도 있습니다.
      // 여기선 복잡도를 줄이기 위해 그냥 실행하고 다음 프레임부터 제외합니다.
      // 단, '파괴된 객체 실행 방지'가 중요하다면 체크 필요.
      // 성능이 우선이므로 체크 생략 (pendingRemovals 검색 비용).
      tickable.tick(deltaTime);
    }
    this.isTicking = false;

    this.processPending();
  }

  private processPending(): void {
    if (this.pendingRemovals.length > 0) {
      for (const tickable of this.pendingRemovals) {
        this.unregisterImmediate(tickable);
      }
      this.pendingRemovals.length = 0;
    }

    if (this.pendingAdditions.length > 0) {
      for (const tickable of this.pendingAdditions) {
        this.registerImmediate(tickable);
      }
      this.pendingAdditions.length = 0;
    }
  }

  /** 모든 등록 해제 */
  public clear(): void {
    this.tickables = [];
    this.pendingAdditions = [];
    this.pendingRemovals = [];
    this.isTicking = false;
  }
}
