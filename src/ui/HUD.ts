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

      // 근접 무기일 때 탄약 UI 숨김
      const ammoContainer = this.currentAmmoElement.parentElement;
      if (ammoContainer) {
        ammoContainer.style.visibility = state.showAmmo ? 'visible' : 'hidden';
      }
    });

    // 점수 상태 구독 (NanoStores)
    scoreStore.subscribe((score) => {
      this.scoreElement.textContent = score.toString();
    });

    // 크로스헤어 반동 효과
    const crosshair = document.getElementById('crosshair');
    let expandTimeout: any;

    if (crosshair) {
      import('../core/events/GameObservables.ts').then(({ GameObservables }) => {
        GameObservables.weaponFire.add(() => {
          crosshair.classList.add('expanded');

          if (expandTimeout) clearTimeout(expandTimeout);
          expandTimeout = setTimeout(() => {
            crosshair.classList.remove('expanded');
          }, 150);
        });
      });
    }
  }
}
