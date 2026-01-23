import { eventBus } from '../core/events/EventBus.ts';
import { GameEvents } from '../types/IEventBus.ts';

export class HUD {
  private scoreElement: HTMLElement;
  private currentAmmoElement: HTMLElement;
  private totalAmmoElement: HTMLElement;

  constructor() {
    this.scoreElement = document.getElementById('score')!;
    this.currentAmmoElement = document.getElementById('current-ammo')!;
    this.totalAmmoElement = document.getElementById('total-ammo')!;

    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    // 탄약 변경 구독
    eventBus.on(GameEvents.WEAPON_AMMO_CHANGED, (data) => {
      this.currentAmmoElement.textContent = data.current.toString();
      this.totalAmmoElement.textContent = data.reserve.toString();
    });

    // 점수 변경 구독
    eventBus.on(GameEvents.SCORE_CHANGED, (data) => {
      this.scoreElement.textContent = data.newScore.toString();
    });
  }
}
