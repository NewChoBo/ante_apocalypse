/**
 * 임의의 생성자를 나타내는 타입. 추상 클래스도 포함할 수 있도록 인터페이스를 사용합니다.
 */
export type Constructor<T = object> = new (...args: any[]) => T;
export type AbstractConstructor<T = object> = abstract new (...args: any[]) => T;

/**
 * 스태츠(Stats) 동기화 기능을 제공하는 Mixin 인터페이스.
 * 외부 노출용 인터페이스와 내부 확장용 인터페이스를 분리할 수 있습니다.
 */
export interface IStatSyncable<TStats> {
  updateStats(stats: Partial<TStats>): void;
}

export interface IStatSyncMixin<TStats> extends IStatSyncable<TStats> {
  stats: TStats;
  onStatsUpdated(stats: Partial<TStats>): void;
}

/**
 * 클래스에 스태츠 동기화 기능을 주입하는 Mixin 팩토리 함수.
 * @param Base 상속받을 베이스 클래스
 */
export function WithStatSync<TBase extends AbstractConstructor, TStats extends Record<string, any>>(
  Base: TBase
): TBase & Constructor<IStatSyncMixin<TStats>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abstract class Mixin extends (Base as any) implements IStatSyncMixin<TStats> {
    // Mixin에서 관리할 스태츠 속성
    public stats: TStats = {} as TStats;

    /**
     * 외부(서버 등)에서 전달된 데이터로 스태츠를 업데이트합니다.
     * @param statsPartial 업데이트할 스태츠의 일부
     */
    public updateStats(statsPartial: Partial<TStats>): void {
      Object.assign(this.stats, statsPartial);
      this.onStatsUpdated(statsPartial);
    }

    /**
     * 스태츠가 업데이트된 후 호출되는 가상 메서드.
     * 하위 클래스에서 오버라이드하여 시각적 업데이트 등을 수행할 수 있습니다.
     */
    public onStatsUpdated(_statsPartial: Partial<TStats>): void {
      // 기본적으로는 아무 작업도 하지 않음
    }
  }

  return Mixin as unknown as TBase & Constructor<IStatSyncMixin<TStats>>;
}
