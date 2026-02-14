import { describe, expect, it, vi } from 'vitest';
import { EventCode } from '@ante/common';
import { PlayerStateManager } from '../../../core/network/PlayerStateManager';
import { NetworkEventRouter } from '../../../core/network/services/NetworkEventRouter';

describe('NetworkEventRouter progression events', () => {
  it('routes wave/upgrade authority events to dedicated observables', () => {
    const router = new NetworkEventRouter(new PlayerStateManager(), () => '1');
    const waveObserver = vi.fn();
    const offerObserver = vi.fn();
    const applyObserver = vi.fn();

    router.onWaveState.add(waveObserver);
    router.onUpgradeOffer.add(offerObserver);
    router.onUpgradeApplied.add(applyObserver);

    router.dispatchLocalEvent(
      EventCode.WAVE_STATE,
      {
        wave: 3,
        phase: 'combat',
        remainingEnemies: 11,
        timeRemaining: 0,
        alivePlayers: 2,
        totalPlayers: 4,
      },
      'server'
    );
    router.dispatchLocalEvent(
      EventCode.UPGRADE_OFFER,
      {
        offerId: 'offer_1',
        playerId: '1',
        wave: 2,
        expiresInSeconds: 12,
        options: [{ id: 'damage_amp', label: 'Damage Amp', description: '+12% damage' }],
      },
      'server'
    );
    router.dispatchLocalEvent(
      EventCode.UPGRADE_APPLY,
      {
        playerId: '1',
        offerId: 'offer_1',
        upgradeId: 'damage_amp',
        stacks: 1,
      },
      'server'
    );

    expect(waveObserver).toHaveBeenCalledTimes(1);
    expect(offerObserver).toHaveBeenCalledTimes(1);
    expect(applyObserver).toHaveBeenCalledTimes(1);
  });

  it('keeps existing combat event routing intact', () => {
    const router = new NetworkEventRouter(new PlayerStateManager(), () => '1');
    const hitObserver = vi.fn();
    router.onPlayerHit.add(hitObserver);

    router.dispatchLocalEvent(
      EventCode.HIT,
      {
        targetId: '2',
        attackerId: '1',
        damage: 15,
        newHealth: 85,
      },
      'server'
    );

    expect(hitObserver).toHaveBeenCalledTimes(1);
    expect(hitObserver.mock.calls[0][0]).toEqual({
      targetId: '2',
      attackerId: '1',
      damage: 15,
      newHealth: 85,
    });
  });

  it('upserts players from INITIAL_STATE so snapshots drive ally movement', () => {
    const playerStateManager = new PlayerStateManager();
    const router = new NetworkEventRouter(playerStateManager, () => '1');
    const playersListObserver = vi.fn();
    const playerUpdatedObserver = vi.fn();

    router.onPlayersList.add(playersListObserver);
    playerStateManager.onPlayerUpdated.add(playerUpdatedObserver);

    router.dispatchLocalEvent(
      EventCode.INITIAL_STATE,
      {
        players: [
          {
            id: '2',
            name: 'Ally',
            position: { x: 0, y: 1.75, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            weaponId: 'Rifle',
            health: 100,
          },
        ],
        enemies: [],
      },
      'server'
    );

    router.dispatchLocalEvent(
      EventCode.INITIAL_STATE,
      {
        players: [
          {
            id: '2',
            name: 'Ally',
            position: { x: 4, y: 1.75, z: 2 },
            rotation: { x: 0, y: 1.2, z: 0 },
            weaponId: 'Rifle',
            health: 88,
          },
        ],
        enemies: [],
      },
      'server'
    );

    expect(playersListObserver).toHaveBeenCalledTimes(2);
    expect(playerUpdatedObserver).toHaveBeenCalledTimes(1);
    expect(playerStateManager.getPlayer('2')).toMatchObject({
      id: '2',
      position: { x: 4, y: 1.75, z: 2 },
      rotation: { x: 0, y: 1.2, z: 0 },
      health: 88,
    });
  });
});
