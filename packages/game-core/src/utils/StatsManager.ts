/**
 * 타입 안전한 스태츠 관리 유틸리티 클래스.
 * Mixin을 대체하여 컴포지션 방식으로 사용됩니다.
 */
export class StatsManager<T extends Record<string, unknown>> {
  public stats: T;

  constructor(
    initialStats: T,
    private onStatsUpdated?: (statsPartial: Partial<T>) => void
  ) {
    this.stats = { ...initialStats };
  }

  /**
   * 스태츠의 일부를 업데이트합니다.
   */
  public updateStats(statsPartial: Partial<T>): void {
    Object.assign(this.stats, statsPartial);
    if (this.onStatsUpdated) {
      this.onStatsUpdated(statsPartial);
    }
  }
}
