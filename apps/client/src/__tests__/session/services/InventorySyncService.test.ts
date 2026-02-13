import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InventorySyncService } from '../../../core/systems/session/InventorySyncService';
import { inventoryStore } from '../../../core/store/GameStore';
import { InventoryManager } from '../../../core/inventory/InventoryManager';
import type { PlayerPawn } from '../../../core/PlayerPawn';
import type { CombatComponent } from '../../../core/components/combat/CombatComponent';

function createService(
  weapons: Array<{ name: string }>,
  overrides?: {
    equipWeapon?: ReturnType<typeof vi.fn>;
    playerPawn?: PlayerPawn;
  }
): InventorySyncService {
  const equipWeapon = overrides?.equipWeapon ?? vi.fn().mockResolvedValue(undefined);
  const combat = {
    getWeapons: (): Array<{ name: string }> => weapons,
    equipWeapon,
  } as unknown as CombatComponent;

  const playerPawn =
    overrides?.playerPawn ??
    ({
      getComponent: vi.fn().mockReturnValue(combat),
    } as unknown as PlayerPawn);

  return new InventorySyncService({
    getPlayerPawn: (): PlayerPawn => playerPawn,
  });
}

describe('InventorySyncService', (): void => {
  beforeEach((): void => {
    inventoryStore.set({
      weaponSlots: [null, null, null, null],
      bagItems: [{ id: 'health_pack', name: 'First Aid Kit', type: 'consumable', count: 2 }],
      maxBagSlots: 24,
    });
  });

  it('syncs combat weapons into slots while preserving consumables', (): void => {
    const service = createService([{ name: 'Pistol' }, { name: 'Rifle' }]);

    service.syncStoreFromCombat();

    const state = inventoryStore.get();
    expect(state.weaponSlots).toEqual(['Pistol', 'Rifle', null, null]);
    expect(state.bagItems).toEqual([
      { id: 'Pistol', name: 'Pistol', type: 'weapon', count: 1 },
      { id: 'Rifle', name: 'Rifle', type: 'weapon', count: 1 },
      { id: 'health_pack', name: 'First Aid Kit', type: 'consumable', count: 2 },
    ]);
  });

  it('drops one consumable stack then re-syncs weapon entries', (): void => {
    const service = createService([{ name: 'Pistol' }]);
    const callbacks = service.createCallbacks();

    callbacks.onDropItem('health_pack');

    const state = inventoryStore.get();
    expect(state.weaponSlots).toEqual(['Pistol', null, null, null]);
    expect(state.bagItems).toEqual([
      { id: 'Pistol', name: 'Pistol', type: 'weapon', count: 1 },
      { id: 'health_pack', name: 'First Aid Kit', type: 'consumable', count: 1 },
    ]);
  });

  it('delegates item use to InventoryManager with local player pawn', (): void => {
    const playerPawn = { getComponent: vi.fn() } as unknown as PlayerPawn;
    const spy = vi.spyOn(InventoryManager, 'useItem').mockImplementation((): void => undefined);
    const service = createService([], { playerPawn });
    const callbacks = service.createCallbacks();

    callbacks.onUseItem('health_pack');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('health_pack', playerPawn);
    spy.mockRestore();
  });
});



