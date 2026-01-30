import { ITickable } from '../types/ITickable.js';

/**
 * 게임 내 모든 ITickable 객체를 관리하고 매 프레임 업데이트를 수행하는 매니저.
 */
export class TickManager {
  private static instance: TickManager;
  private tickables: ITickable[] = [];

  private constructor() {}

  public static getInstance(): TickManager {
    if (!TickManager.instance) {
      TickManager.instance = new TickManager();
    }
    return TickManager.instance;
  }

  /** 업데이트 대상 등록 */
  public register(tickable: ITickable): void {
    if (this.tickables.includes(tickable)) return;

    this.tickables.push(tickable);
    // 우선순위에 따라 정렬 (오름차순)
    this.tickables.sort((a, b) => a.priority - b.priority);
  }

  /** 업데이트 대상 해제 */
  public unregister(tickable: ITickable): void {
    const index = this.tickables.indexOf(tickable);
    if (index !== -1) {
      this.tickables.splice(index, 1);
    }
  }

  /** 등록된 모든 객체 업데이트 실행 */
  public tick(deltaTime: number): void {
    // 업데이트 중에 리스트가 변경될 수 있으므로 복사본을 순회
    const items = [...this.tickables];
    for (const tickable of items) {
      tickable.tick(deltaTime);
    }
  }

  /** 모든 등록 해제 */
  public clear(): void {
    this.tickables = [];
  }
}
