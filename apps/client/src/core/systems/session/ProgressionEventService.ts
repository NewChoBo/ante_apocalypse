import { Observer } from '@babylonjs/core';
import type { UpgradeApplyPayload, UpgradeOfferPayload, WaveStatePayload } from '@ante/common';
import type { INetworkManager } from '../../interfaces/INetworkManager';
import type { IUIManager } from '../../../ui/IUIManager';
import { BabylonUpgradeSelectionOverlay, IUpgradeSelectionOverlay } from '../../../ui/UpgradeSelectionOverlay';

type WindowLike = Pick<Window, 'addEventListener' | 'removeEventListener'>;
type UpgradeOverlayFactory = (uiManager: IUIManager) => IUpgradeSelectionOverlay;

const noopWindowRef: WindowLike = {
  addEventListener: (): void => undefined,
  removeEventListener: (): void => undefined,
};

function resolveDefaultWindowRef(): WindowLike {
  const candidate = (globalThis as { window?: WindowLike }).window;
  if (
    candidate &&
    typeof candidate.addEventListener === 'function' &&
    typeof candidate.removeEventListener === 'function'
  ) {
    return candidate;
  }
  return noopWindowRef;
}

export class ProgressionEventService {
  private waveStateObserver: Observer<WaveStatePayload> | null = null;
  private upgradeOfferObserver: Observer<UpgradeOfferPayload> | null = null;
  private upgradeApplyObserver: Observer<UpgradeApplyPayload> | null = null;

  private pendingOffer: UpgradeOfferPayload | null = null;
  private offerExpiresAtMs = 0;
  private lastWavePhaseKey = '';
  private offerCountdownInterval: ReturnType<typeof setInterval> | null = null;
  private overlay: IUpgradeSelectionOverlay | null = null;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.handleUpgradeHotkey(event.code)) {
      event.preventDefault();
    }
  };

  constructor(
    private readonly networkManager: INetworkManager,
    private readonly uiManager: IUIManager,
    private readonly windowRef: WindowLike = resolveDefaultWindowRef(),
    private readonly overlayFactory: UpgradeOverlayFactory = (
      manager: IUIManager
    ): IUpgradeSelectionOverlay => new BabylonUpgradeSelectionOverlay(manager.getTexture())
  ) {}

  public initialize(): void {
    if (this.waveStateObserver || this.upgradeOfferObserver || this.upgradeApplyObserver) return;
    this.overlay = this.overlayFactory(this.uiManager);

    this.waveStateObserver = this.networkManager.onWaveState.add((payload: WaveStatePayload): void => {
      this.handleWaveState(payload);
    });
    this.upgradeOfferObserver = this.networkManager.onUpgradeOffer.add(
      (payload: UpgradeOfferPayload): void => {
        this.handleUpgradeOffer(payload);
      }
    );
    this.upgradeApplyObserver = this.networkManager.onUpgradeApplied.add(
      (payload: UpgradeApplyPayload): void => {
        this.handleUpgradeApplied(payload);
      }
    );
    this.windowRef.addEventListener('keydown', this.onKeyDown);
  }

  public handleUpgradeHotkey(code: string): boolean {
    const offer = this.pendingOffer;
    if (!offer) return false;

    if (this.offerExpiresAtMs > 0 && Date.now() > this.offerExpiresAtMs) {
      this.clearPendingOffer();
      return false;
    }

    const slotIndex = this.resolveHotkeyIndex(code);
    if (slotIndex === -1) return false;

    const option = offer.options[slotIndex];
    if (!option) return false;

    return this.submitOfferChoice(offer.offerId, option.id, option.label);
  }

  public dispose(): void {
    if (this.waveStateObserver) {
      this.networkManager.onWaveState.remove(this.waveStateObserver);
      this.waveStateObserver = null;
    }
    if (this.upgradeOfferObserver) {
      this.networkManager.onUpgradeOffer.remove(this.upgradeOfferObserver);
      this.upgradeOfferObserver = null;
    }
    if (this.upgradeApplyObserver) {
      this.networkManager.onUpgradeApplied.remove(this.upgradeApplyObserver);
      this.upgradeApplyObserver = null;
    }

    this.windowRef.removeEventListener('keydown', this.onKeyDown);
    this.clearPendingOffer();
    this.lastWavePhaseKey = '';
    this.overlay?.dispose();
    this.overlay = null;
  }

  private handleWaveState(payload: WaveStatePayload): void {
    const phaseKey = `${payload.wave}:${payload.phase}`;
    if (phaseKey === this.lastWavePhaseKey) return;

    this.lastWavePhaseKey = phaseKey;
    this.uiManager.showNotification(this.formatWaveBanner(payload));

    if (payload.phase !== 'upgrade') {
      this.clearPendingOffer();
    }
  }

  private handleUpgradeOffer(payload: UpgradeOfferPayload): void {
    if (!this.isLocalPlayer(payload.playerId)) return;

    this.pendingOffer = payload;
    this.offerExpiresAtMs = Date.now() + payload.expiresInSeconds * 1000;
    this.overlay?.showOffer(payload, (upgradeId: string): void => {
      this.submitOfferChoice(payload.offerId, upgradeId);
    });
    this.startOfferCountdown();
    this.syncOfferCountdown();
    this.uiManager.showNotification(this.formatUpgradePrompt(payload));
  }

  private handleUpgradeApplied(payload: UpgradeApplyPayload): void {
    if (!this.isLocalPlayer(payload.playerId)) return;

    if (this.pendingOffer?.offerId === payload.offerId) {
      this.clearPendingOffer();
    }

    this.uiManager.showNotification(
      `UPGRADE_APPLIED_${this.sanitizeForBanner(payload.upgradeId)}_X${payload.stacks}`
    );
  }

  private formatWaveBanner(payload: WaveStatePayload): string {
    const phaseLabel = payload.phase.toUpperCase();
    if (payload.phase === 'combat') {
      return `WAVE_${payload.wave}_${phaseLabel}_ENEMY_${payload.remainingEnemies}`;
    }
    return `WAVE_${payload.wave}_${phaseLabel}`;
  }

  private formatUpgradePrompt(payload: UpgradeOfferPayload): string {
    const optionLabels = payload.options
      .slice(0, 3)
      .map((option, idx) => `[${idx + 1}]${this.sanitizeForBanner(option.label)}`)
      .join(' ');
    return `UPGRADE_READY_W${payload.wave} ${optionLabels}`;
  }

  private sanitizeForBanner(text: string): string {
    return text.replace(/\s+/g, '_').toUpperCase();
  }

  private resolveHotkeyIndex(code: string): number {
    switch (code) {
      case 'Digit1':
      case 'Numpad1':
        return 0;
      case 'Digit2':
      case 'Numpad2':
        return 1;
      case 'Digit3':
      case 'Numpad3':
        return 2;
      default:
        return -1;
    }
  }

  private isLocalPlayer(playerId: string): boolean {
    const localPlayerId = this.networkManager.getSocketId();
    return Boolean(localPlayerId) && localPlayerId === playerId;
  }

  private submitOfferChoice(offerId: string, upgradeId: string, labelHint?: string): boolean {
    const offer = this.pendingOffer;
    if (!offer || offer.offerId !== offerId) return false;

    const option = offer.options.find((entry) => entry.id === upgradeId);
    if (!option) return false;

    this.networkManager.submitUpgradePick(offer.offerId, option.id);
    const label = labelHint || option.label || option.id;
    this.uiManager.showNotification(`UPGRADE_LOCKED_${this.sanitizeForBanner(label)}`);
    this.clearPendingOffer();
    return true;
  }

  private startOfferCountdown(): void {
    if (this.offerCountdownInterval) {
      clearInterval(this.offerCountdownInterval);
      this.offerCountdownInterval = null;
    }

    this.offerCountdownInterval = setInterval((): void => {
      this.syncOfferCountdown();
    }, 250);
  }

  private syncOfferCountdown(): void {
    if (!this.pendingOffer) return;

    const remainingMs = this.offerExpiresAtMs - Date.now();
    if (remainingMs <= 0) {
      this.clearPendingOffer();
      return;
    }

    this.overlay?.setTimeRemaining(Math.ceil(remainingMs / 1000));
  }

  private clearPendingOffer(): void {
    if (this.offerCountdownInterval) {
      clearInterval(this.offerCountdownInterval);
      this.offerCountdownInterval = null;
    }

    this.overlay?.hide();
    this.pendingOffer = null;
    this.offerExpiresAtMs = 0;
  }
}
