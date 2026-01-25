import { inventoryStore, BagItem } from '../store/GameStore';
import { getItemMetadata } from '../items/ItemDatabase';
import type { PlayerPawn } from '../PlayerPawn';

export class InventoryManager {
  /**
   * 장비 슬롯에 무기 장착
   */
  static equipWeapon(slotIndex: number, weaponId: string | null): void {
    const state = inventoryStore.get();
    const newWeaponSlots = [...state.weaponSlots];

    // 이미 같은 무기가 다른 슬롯에 있다면 해제 (중복 장착 방지)
    if (weaponId) {
      newWeaponSlots.forEach((id, idx) => {
        if (id === weaponId) newWeaponSlots[idx] = null;
      });
    }

    newWeaponSlots[slotIndex] = weaponId;
    inventoryStore.setKey('weaponSlots', newWeaponSlots);
  }

  /**
   * 가방에 아이템 추가
   */
  static addItemToBag(itemId: string, count: number = 1): boolean {
    const state = inventoryStore.get();
    const meta = getItemMetadata(itemId);
    if (!meta) return false;

    const existingItem = state.bagItems.find((item) => item.id === itemId);
    if (existingItem) {
      // 스택 가능 아이템 처리 (나중에 메타데이터에 stackable 추가 가능)
      const newBagItems = state.bagItems.map((item) =>
        item.id === itemId ? { ...item, count: item.count + count } : item
      );
      inventoryStore.setKey('bagItems', newBagItems);
      return true;
    }

    if (state.bagItems.length >= state.maxBagSlots) {
      console.warn('Inventory full');
      return false;
    }

    const newItem: BagItem = {
      id: itemId,
      name: meta.name,
      type: meta.type,
      count: count,
    };

    inventoryStore.setKey('bagItems', [...state.bagItems, newItem]);
    return true;
  }

  /**
   * 아이템 사용
   */
  static useItem(itemId: string, player: PlayerPawn): void {
    const state = inventoryStore.get();
    const itemIndex = state.bagItems.findIndex((i) => i.id === itemId);
    if (itemIndex === -1) return;

    const item = state.bagItems[itemIndex];
    const meta = getItemMetadata(itemId);
    if (!meta) return;

    // 사용 로직 (소모품인 경우 효과 적용)
    if (meta.type === 'consumable') {
      console.log(`Using consumable: ${item.name}`);

      if (meta.onUse) {
        meta.onUse(player);
      }

      // 개수 감소 및 소모
      if (item.count > 1) {
        const newBagItems = [...state.bagItems];
        newBagItems[itemIndex] = { ...item, count: item.count - 1 };
        inventoryStore.setKey('bagItems', newBagItems);
      } else {
        const newBagItems = state.bagItems.filter((i) => i.id !== itemId);
        inventoryStore.setKey('bagItems', newBagItems);
      }
    } else if (meta.type === 'weapon') {
      // 무기인 경우 장착 로직 (이미 장착되어있지 않은 경우)
      // 이 로직은 보통 UI 콜백이나 Controller에서 호출될 것을 예상
      console.log(`Weapon selected: ${item.name}`);
    }
  }

  /**
   * 가방 내 아이템 위치 교환
   */
  static swapBagItems(fromIndex: number, toIndex: number): void {
    const state = inventoryStore.get();
    const newBagItems = [...state.bagItems];

    // 슬롯 범위를 넘어서는 빈 슬롯에 드롭하는 경우도 처리 가능하도록 가방 크기만큼 배열 유지 고려 가능
    // 현재는 단순 교환
    if (fromIndex >= newBagItems.length || toIndex >= state.maxBagSlots) return;

    const temp = newBagItems[fromIndex];
    newBagItems[fromIndex] = newBagItems[toIndex];
    newBagItems[toIndex] = temp;

    inventoryStore.setKey(
      'bagItems',
      newBagItems.filter((i) => i !== undefined)
    );
  }

  /**
   * 아이템 버리기
   */
  static dropItem(itemId: string): void {
    const state = inventoryStore.get();
    const newBagItems = state.bagItems.filter((i) => i.id !== itemId);
    inventoryStore.setKey('bagItems', newBagItems);
  }
}
