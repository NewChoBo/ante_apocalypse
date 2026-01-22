export class UIManager {
  private scoreElement: HTMLElement | null;
  private currentAmmoElement: HTMLElement | null;
  private totalAmmoElement: HTMLElement | null;
  private reloadMessageElement: HTMLElement | null;
  private pauseOverlay: HTMLElement | null;
  private startOverlay: HTMLElement | null;
  private hudElement: HTMLElement | null;

  constructor() {
    this.scoreElement = document.getElementById('score');
    this.currentAmmoElement = document.getElementById('current-ammo');
    this.totalAmmoElement = document.getElementById('total-ammo');
    this.reloadMessageElement = document.getElementById('reload-message');
    this.pauseOverlay = document.getElementById('pause-overlay');
    this.startOverlay = document.getElementById('start-overlay');
    this.hudElement = document.getElementById('hud');
  }

  public updateScore(score: number): void {
    if (this.scoreElement) this.scoreElement.textContent = score.toString();
  }

  public updateAmmo(current: number, total: number): void {
    if (this.currentAmmoElement) this.currentAmmoElement.textContent = current.toString();
    if (this.totalAmmoElement) this.totalAmmoElement.textContent = total.toString();
  }

  public setReloading(isReloading: boolean): void {
    if (this.reloadMessageElement) {
      this.reloadMessageElement.style.display = isReloading ? 'block' : 'none';
    }
  }

  public setPaused(isPaused: boolean): void {
    if (this.pauseOverlay) {
      this.pauseOverlay.style.display = isPaused ? 'flex' : 'none';
    }
  }

  public setGameStarted(started: boolean): void {
    if (this.startOverlay) {
      this.startOverlay.style.display = started ? 'none' : 'flex';
    }
    if (this.hudElement) {
      this.hudElement.style.display = started ? 'block' : 'none';
    }
  }
}
