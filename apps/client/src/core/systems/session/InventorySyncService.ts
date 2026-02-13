import { CombatComponent } from '../../components/CombatComponent';
import { InventoryManager } from '../../inventory/InventoryManager';
import { PlayerPawn } from '../../PlayerPawn';
import { inventoryStore } from '../../store/GameStore';
import type { InventoryCallbacks } from '../../../ui/inventory/Config';

interface InventorySyncServiceDeps {
  getPlayerPawn: () => PlayerPawn | null;
}

export class InventorySyncService {
  constructor(private readonly deps: InventorySyncServiceDeps) {}

  public createCallbacks(): InventoryCallbacks {
    return {
      onEquipWeapon: async (_slot: number, weaponId: string | null): Promise<void> => {
        const combat = this.deps.getPlayerPawn()?.getComponent(CombatComponent);
        if (combat && weaponId) {
          await combat.equipWeapon(weaponId);
        }
      },
      onUseItem: (itemId: string): void => {
        const playerPawn = this.deps.getPlayerPawn();
        if (!playerPawn) return;
        InventoryManager.useItem(itemId, playerPawn);
        this.syncStoreFromCombat();
      },
      onDropItem: (itemId: string): void => {
        this.dropBagItem(itemId);
        this.syncStoreFromCombat();
      },
    };
  }

  public syncStoreFromCombat(): void {
    const combat = this.deps.getPlayerPawn()?.getComponent(CombatComponent);
    if (!combat) return;

    const weapons = combat.getWeapons();
    const slots: (string | null)[] = [null, null, null, null];
    weapons.forEach((weapon, index): void => {
      if (index < slots.length) {
        slots[index] = weapon.name;
      }
    });

    const weaponBagItems = weapons.map((weapon) => ({
      id: weapon.name,
      name: weapon.name,
      type: 'weapon' as const,
      count: 1,
    }));

    const currentState = inventoryStore.get();
    const consumables = currentState.bagItems.filter((item) => item.type === 'consumable');

    inventoryStore.set({
      ...currentState,
      weaponSlots: slots,
      bagItems: [...weaponBagItems, ...consumables],
    });
  }

  private dropBagItem(itemId: string): void {
    const state = inventoryStore.get();
    const bag = [...state.bagItems];
    const itemIndex = bag.findIndex((item) => item.id === itemId);

    if (itemIndex === -1) return;

    const item = bag[itemIndex];
    if (item.count > 1) {
      bag[itemIndex] = { ...item, count: item.count - 1 };
    } else {
      bag.splice(itemIndex, 1);
    }
    inventoryStore.setKey('bagItems', bag);
  }
}
