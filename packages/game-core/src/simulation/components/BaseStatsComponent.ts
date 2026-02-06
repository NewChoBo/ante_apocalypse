import { Scene } from '@babylonjs/core';
import { IPawnCore } from '../../types/IPawnCore.js';
import { BaseComponent } from '../BaseComponent.js';

/**
 * 클래스(Pawn)에 스태츠 동기화 기능을 제공하는 컴포넌트.
 * Mixin을 대체하여 타입 안전성을 높입니다.
 */
export abstract class BaseStatsComponent<
  TStats extends Record<string, unknown>,
> extends BaseComponent {
  public stats: TStats;

  constructor(owner: IPawnCore, scene: Scene, initialStats: TStats) {
    super(owner, scene);
    this.stats = initialStats;
  }

  /**
   * 외부(서버 등)에서 전달된 데이터로 스태츠를 업데이트합니다.
   * @param statsPartial 업데이트할 스태츠의 일부
   */
  public updateStats(statsPartial: Partial<TStats>): void {
    Object.assign(this.stats, statsPartial);
    this.onStatsUpdated(statsPartial);
  }

  /**
   * 스태츠가 업데이트된 후 호출되는 추상 메서드.
   */
  protected abstract onStatsUpdated(statsPartial: Partial<TStats>): void;

  public update(_deltaTime: number): void {
    // 스태츠 자체의 시간 기반 업데이트가 필요한 경우 사용
  }
}
