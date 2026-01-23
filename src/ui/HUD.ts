import { scoreStore, ammoStore } from '../core/store/GameStore.ts';

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
    // 탄약 상태 구독 (NanoStores)
    ammoStore.subscribe((state) => {
      this.currentAmmoElement.textContent = state.current.toString();
      this.totalAmmoElement.textContent = state.reserve.toString();
    });

    // 점수 상태 구독 (NanoStores)
    scoreStore.subscribe((score) => {
      this.scoreElement.textContent = score.toString();
    });
  }
}
