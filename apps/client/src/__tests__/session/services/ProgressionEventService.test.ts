import { describe, expect, it, vi } from 'vitest';
import { Observable } from '@babylonjs/core';
import type { UpgradeApplyPayload, UpgradeOfferPayload, WaveStatePayload } from '@ante/common';
import { ProgressionEventService } from '../../../core/systems/session/ProgressionEventService';
import type { INetworkManager } from '../../../core/interfaces/INetworkManager';
import type { IUIManager } from '../../../ui/IUIManager';

interface NetworkMockBundle {
  networkManager: INetworkManager;
  onWaveState: Observable<WaveStatePayload>;
  onUpgradeOffer: Observable<UpgradeOfferPayload>;
  onUpgradeApplied: Observable<UpgradeApplyPayload>;
  submitUpgradePick: ReturnType<typeof vi.fn>;
}

function createNetworkManagerMock(socketId: string = 'local'): NetworkMockBundle {
  const onWaveState = new Observable<WaveStatePayload>();
  const onUpgradeOffer = new Observable<UpgradeOfferPayload>();
  const onUpgradeApplied = new Observable<UpgradeApplyPayload>();
  const submitUpgradePick = vi.fn();

  const networkManager = {
    onWaveState,
    onUpgradeOffer,
    onUpgradeApplied,
    getSocketId: vi.fn((): string => socketId),
    submitUpgradePick,
  } as unknown as INetworkManager;

  return {
    networkManager,
    onWaveState,
    onUpgradeOffer,
    onUpgradeApplied,
    submitUpgradePick,
  };
}

function createUiManagerMock(): IUIManager & { showNotification: ReturnType<typeof vi.fn> } {
  return {
    showNotification: vi.fn(),
  } as unknown as IUIManager & { showNotification: ReturnType<typeof vi.fn> };
}

function createWindowRefMock(): Pick<Window, 'addEventListener' | 'removeEventListener'> {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

describe('ProgressionEventService', (): void => {
  it('announces only phase transitions for wave state updates', (): void => {
    const { networkManager, onWaveState } = createNetworkManagerMock();
    const uiManager = createUiManagerMock();
    const service = new ProgressionEventService(networkManager, uiManager, createWindowRefMock());
    service.initialize();

    onWaveState.notifyObservers({
      wave: 1,
      phase: 'warmup',
      remainingEnemies: 0,
      timeRemaining: 20,
      alivePlayers: 1,
      totalPlayers: 1,
    });
    onWaveState.notifyObservers({
      wave: 1,
      phase: 'warmup',
      remainingEnemies: 0,
      timeRemaining: 18,
      alivePlayers: 1,
      totalPlayers: 1,
    });
    onWaveState.notifyObservers({
      wave: 1,
      phase: 'combat',
      remainingEnemies: 10,
      timeRemaining: 0,
      alivePlayers: 1,
      totalPlayers: 1,
    });

    expect(uiManager.showNotification).toHaveBeenCalledTimes(2);
    expect(uiManager.showNotification).toHaveBeenNthCalledWith(1, 'WAVE_1_WARMUP');
    expect(uiManager.showNotification).toHaveBeenNthCalledWith(2, 'WAVE_1_COMBAT_ENEMY_10');
  });

  it('submits upgrade pick when valid hotkey is pressed for local offer', (): void => {
    const { networkManager, onUpgradeOffer, submitUpgradePick } = createNetworkManagerMock();
    const uiManager = createUiManagerMock();
    const service = new ProgressionEventService(networkManager, uiManager, createWindowRefMock());
    service.initialize();

    onUpgradeOffer.notifyObservers({
      offerId: 'offer_1',
      playerId: 'local',
      wave: 2,
      expiresInSeconds: 12,
      options: [
        { id: 'damage_amp', label: 'Damage Amplifier', description: 'd' },
        { id: 'defense_amp', label: 'Defense Matrix', description: 'd' },
        { id: 'max_hp_amp', label: 'Vital Surge', description: 'd' },
      ],
    });

    const handled = service.handleUpgradeHotkey('Digit2');

    expect(handled).toBe(true);
    expect(submitUpgradePick).toHaveBeenCalledTimes(1);
    expect(submitUpgradePick).toHaveBeenCalledWith('offer_1', 'defense_amp');
    expect(uiManager.showNotification).toHaveBeenCalledWith('UPGRADE_LOCKED_DEFENSE_MATRIX');
  });

  it('ignores remote offers and clears pending offer after local apply', (): void => {
    const { networkManager, onUpgradeOffer, onUpgradeApplied, submitUpgradePick } =
      createNetworkManagerMock();
    const uiManager = createUiManagerMock();
    const service = new ProgressionEventService(networkManager, uiManager, createWindowRefMock());
    service.initialize();

    onUpgradeOffer.notifyObservers({
      offerId: 'offer_remote',
      playerId: 'other',
      wave: 2,
      expiresInSeconds: 12,
      options: [
        { id: 'damage_amp', label: 'Damage Amplifier', description: 'd' },
        { id: 'defense_amp', label: 'Defense Matrix', description: 'd' },
      ],
    });

    expect(service.handleUpgradeHotkey('Digit1')).toBe(false);
    expect(submitUpgradePick).not.toHaveBeenCalled();

    onUpgradeOffer.notifyObservers({
      offerId: 'offer_local',
      playerId: 'local',
      wave: 2,
      expiresInSeconds: 12,
      options: [
        { id: 'damage_amp', label: 'Damage Amplifier', description: 'd' },
        { id: 'defense_amp', label: 'Defense Matrix', description: 'd' },
      ],
    });
    onUpgradeApplied.notifyObservers({
      playerId: 'local',
      offerId: 'offer_local',
      upgradeId: 'damage_amp',
      stacks: 1,
    });

    expect(service.handleUpgradeHotkey('Digit1')).toBe(false);
    expect(submitUpgradePick).not.toHaveBeenCalled();
    expect(uiManager.showNotification).toHaveBeenCalledWith('UPGRADE_APPLIED_DAMAGE_AMP_X1');
  });
});
