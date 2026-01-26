import { ITickable } from '../interfaces/ITickable';

/**
 * 게임 내 모든 ITickable 객체를 관리하고 매 프레임 업데이트를 수행하는 매니저.
 */
export class TickManager {
  private static instance: TickManager;
  private tickables: ITickable[] = [];
  private toRegister: ITickable[] = [];
  private toUnregister: ITickable[] = [];
  private isTicking: boolean = false;

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
      if (!this.toRegister.includes(tickable)) {
        this.toRegister.push(tickable);
      }
      return;
    }

    if (this.tickables.includes(tickable)) return;

    this.tickables.push(tickable);
    this.tickables.sort((a, b) => a.priority - b.priority);
  }

  /** 업데이트 대상 해제 */
  public unregister(tickable: ITickable): void {
    if (this.isTicking) {
      if (!this.toUnregister.includes(tickable)) {
        this.toUnregister.push(tickable);
      }
      return;
    }

    const index = this.tickables.indexOf(tickable);
    if (index !== -1) {
      this.tickables.splice(index, 1);
    }
  }

  /** 등록된 모든 객체 업데이트 실행 */
  public tick(deltaTime: number): void {
    this.isTicking = true;
    for (const tickable of this.tickables) {
      tickable.tick(deltaTime);
    }
    this.isTicking = false;

    // Process deferred queue
    if (this.toUnregister.length > 0) {
      this.toUnregister.forEach((t) => this.unregister(t));
      this.toUnregister = [];
    }
    if (this.toRegister.length > 0) {
      this.toRegister.forEach((t) => this.register(t));
      this.toRegister = [];
    }
  }

  /** 모든 등록 해제 */
  public clear(): void {
    this.tickables = [];
  }
}
