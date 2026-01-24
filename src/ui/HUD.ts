import { scoreStore, ammoStore, playerHealthStore } from '../core/store/GameStore.ts';
import { GameObservables } from '../core/events/GameObservables.ts';
import { Observer } from '@babylonjs/core';

export class HUD {
  private scoreElement: HTMLElement;
  private currentAmmoElement: HTMLElement;
  private totalAmmoElement: HTMLElement;
  private healthBarElement: HTMLElement;
  private healthValueElement: HTMLElement;
  private damageOverlay: HTMLElement;

  private curAmmoUnsub: (() => void) | null = null;
  private scoreUnsub: (() => void) | null = null;
  private healthUnsub: (() => void) | null = null;
  private weaponFireObserver: Observer<any> | null = null;
  private expandTimeout: any;
  private previousHealth: number = 100;

  constructor() {
    this.scoreElement = document.getElementById('score')!;
    this.currentAmmoElement = document.getElementById('current-ammo')!;
    this.totalAmmoElement = document.getElementById('total-ammo')!;
    this.healthBarElement = document.getElementById('health-bar')!;
    this.healthValueElement = document.getElementById('health-value')!;
    this.damageOverlay = document.getElementById('damage-overlay')!;

    this.setupSubscriptions();
  }

  private showDamageFlash(): void {
    this.damageOverlay.classList.remove('hit');
    void this.damageOverlay.offsetWidth; // Trigger reflow
    this.damageOverlay.classList.add('hit');
  }

  private setupSubscriptions(): void {
    // 탄약 상태 구독 (NanoStores)
    this.curAmmoUnsub = ammoStore.subscribe((state) => {
      this.currentAmmoElement.textContent = state.current.toString();
      this.totalAmmoElement.textContent = state.reserve.toString();

      // 근접 무기일 때 탄약 UI 숨김
      const ammoContainer = this.currentAmmoElement.parentElement;
      if (ammoContainer) {
        ammoContainer.style.visibility = state.showAmmo ? 'visible' : 'hidden';
      }
    });

    // 점수 상태 구독 (NanoStores)
    this.scoreUnsub = scoreStore.subscribe((score) => {
      this.scoreElement.textContent = score.toString();
    });

    // 체력 상태 구독 (NanoStores)
    this.healthUnsub = playerHealthStore.subscribe((health) => {
      if (health < this.previousHealth) {
        this.showDamageFlash();
      }
      this.previousHealth = health;

      this.healthBarElement.style.width = `${health}%`;
      this.healthValueElement.textContent = Math.ceil(health).toString();

      // 체력에 따른 색상 변경
      if (health < 30) {
        this.healthBarElement.style.background = '#f44336'; // Red
      } else if (health < 60) {
        this.healthBarElement.style.background = '#ffeb3b'; // Yellow
      } else {
        this.healthBarElement.style.background = 'linear-gradient(90deg, #ff5252, #f44336)';
      }
    });

    // 크로스헤어 반동 효과
    const crosshair = document.getElementById('crosshair');

    if (crosshair) {
      this.weaponFireObserver = GameObservables.weaponFire.add(() => {
        crosshair.classList.add('expanded');

        if (this.expandTimeout) clearTimeout(this.expandTimeout);
        this.expandTimeout = setTimeout(() => {
          crosshair.classList.remove('expanded');
        }, 150);
      });
    }
  }

  public dispose(): void {
    if (this.curAmmoUnsub) {
      this.curAmmoUnsub();
      this.curAmmoUnsub = null;
    }
    if (this.scoreUnsub) {
      this.scoreUnsub();
      this.scoreUnsub = null;
    }
    if (this.healthUnsub) {
      this.healthUnsub();
      this.healthUnsub = null;
    }
    if (this.weaponFireObserver) {
      GameObservables.weaponFire.remove(this.weaponFireObserver);
      this.weaponFireObserver = null;
    }
    if (this.expandTimeout) {
      clearTimeout(this.expandTimeout);
    }
  }
}
