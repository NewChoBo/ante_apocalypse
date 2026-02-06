import { BaseWeapon } from './BaseWeapon.js';
import { WeaponStats } from '../weapons/WeaponRegistry.js';
import { StateMachine, TransitionMap } from '../utils/StateMachine.js';
import { StatsManager } from '../utils/StatsManager.js';

export type WeaponState = 'Ready' | 'Firing' | 'Reloading' | 'Empty';

/** 무기 상태 전이 규칙 정의 */
const FirearmTransitions: TransitionMap<WeaponState> = {
  Ready: ['Firing', 'Reloading', 'Empty'],
  Firing: ['Ready', 'Reloading', 'Empty'],
  Reloading: ['Ready'],
  Empty: ['Reloading'],
};

/**
 * 컴포지션을 활용한 Firearm 클래스.
 * FSM과 StatsManager를 통해 무기의 상태와 스태츠를 관리합니다.
 */
export class Firearm extends BaseWeapon {
  private fsm: StateMachine<WeaponState>;
  private statsManager: StatsManager<WeaponStats>;

  public get currentState(): WeaponState {
    return this.fsm.currentState;
  }

  public get stats(): WeaponStats {
    return this.statsManager.stats;
  }

  public get magazineSize(): number {
    return this.stats.magazineSize || 0;
  }

  public get fireRate(): number {
    return this.stats.fireRate || 0.1;
  }

  public get reloadTime(): number {
    return this.stats.reloadTime || 1;
  }

  protected reloadTimer: number = 0;

  constructor(id: string, ownerId: string, stats: WeaponStats) {
    super(id, ownerId);

    this.statsManager = new StatsManager(stats, (partial) => this.onStatsUpdated(partial));
    this.fsm = new StateMachine(FirearmTransitions, 'Ready', (ns, os) =>
      this.onStateChanged(ns, os)
    );

    this.currentAmmo = stats.magazineSize || 0;

    // 초기 탄약 상태에 따른 상태 설정
    if (this.currentAmmo === 0 && this.magazineSize > 0) {
      this.fsm.transitionTo('Empty');
    }
  }

  /**
   * 장전을 시도합니다. FSM 규칙에 따라 상태가 변경됩니다.
   */
  public reload(): void {
    if (this.currentAmmo === this.magazineSize || this.reserveAmmo === 0) return;

    if (this.fsm.transitionTo('Reloading')) {
      this.reloadTimer = 0;
    }
  }

  /**
   * 장전 로직 완료 처리.
   */
  public reloadLogic(): void {
    const needed = this.magazineSize - this.currentAmmo;
    const amount = Math.min(needed, this.reserveAmmo);

    this.currentAmmo += amount;
    this.reserveAmmo -= amount;

    // 장전 완료 후 Ready 상태로 복귀
    this.fsm.transitionTo('Ready');
  }

  public override fireLogic(): boolean {
    // FSM 상태 확인 (Ready 또는 Firing 상태여야 함)
    if (this.currentState !== 'Ready' && this.currentState !== 'Firing') {
      return false;
    }

    if (super.fireLogic()) {
      if (this.currentAmmo <= 0) {
        this.fsm.transitionTo('Empty');
      } else {
        this.fsm.transitionTo('Firing');
      }
      return true;
    }
    return false;
  }

  public override tick(deltaTime: number): void {
    if (this.currentState === 'Reloading') {
      this.reloadTimer += deltaTime;
      if (this.reloadTimer >= this.reloadTime) {
        this.reloadLogic();
      }
    }

    // Firing 상태에서 일정 시간 후 Ready로 복귀하는 로직 등을 추가할 수 있음
    if (this.currentState === 'Firing') {
      const now = Date.now() / 1000;
      if (now - this.lastFireTime >= this.fireRate) {
        this.fsm.transitionTo('Ready');
      }
    }
  }

  public transitionTo(state: WeaponState): boolean {
    return this.fsm.transitionTo(state);
  }

  public updateStats(partial: Partial<WeaponStats>): void {
    this.statsManager.updateStats(partial);
  }

  protected onStateChanged(_newState: WeaponState, _oldState: WeaponState): void {
    // 상속받은 클래스에서 오버라이드 가능하도록
  }

  protected onStatsUpdated(_partial: Partial<WeaponStats>): void {
    // 상속받은 클래스에서 오버라이드 가능하도록
  }
}
