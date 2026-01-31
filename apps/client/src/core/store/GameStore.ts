import { atom, map, WritableAtom, MapStore } from 'nanostores';
import { Logger } from '@ante/common';

const logger = new Logger('GameStore');

declare global {
  interface Window {
    __GAME_STORES__?: {
      scoreStore: WritableAtom<number>;
      gameStateStore: WritableAtom<'READY' | 'PLAYING' | 'GAME_OVER' | 'DEAD'>;
      ammoStore: MapStore<AmmoState>;
      playerHealthStore: WritableAtom<number>;
      inventoryStore: MapStore<InventoryState>;
    };
  }
}

type GameStores = {
  scoreStore: WritableAtom<number>;
  gameStateStore: WritableAtom<'READY' | 'PLAYING' | 'GAME_OVER' | 'DEAD'>;
  ammoStore: MapStore<AmmoState>;
  playerHealthStore: WritableAtom<number>;
  inventoryStore: MapStore<InventoryState>;
};

function initStores(): GameStores {
  if (window.__GAME_STORES__) {
    logger.log('Reusing existing global stores (Singleton)');
    return window.__GAME_STORES__;
  }

  logger.log('Initializing new global stores');
  const stores = {
    scoreStore: atom<number>(0),
    gameStateStore: atom<'READY' | 'PLAYING' | 'GAME_OVER' | 'DEAD'>('READY'),
    ammoStore: map<AmmoState>({
      current: 0,
      reserve: 0,
      weaponName: 'None',
      showAmmo: true,
    }),
    playerHealthStore: atom<number>(100),
    inventoryStore: map<InventoryState>({
      weaponSlots: ['Pistol', 'Rifle', 'Knife', 'Bat'],
      bagItems: [
        { id: 'health_pack', name: 'First Aid Kit', type: 'consumable', count: 2 },
        { id: 'ammo_box', name: 'Ammo Crate', type: 'consumable', count: 1 },
        { id: 'ammo_generic', name: 'Generic Ammo', type: 'consumable', count: 5 },
      ],
      maxBagSlots: 24,
    }),
  };

  window.__GAME_STORES__ = stores;
  return stores;
}

/**
 * 인벤토리 아이템 정보
 */
export interface InventoryItem {
  id: string;
  name: string;
  type: 'weapon' | 'consumable';
  icon?: string;
}

export interface BagItem extends InventoryItem {
  count: number;
}

export interface InventoryState {
  weaponSlots: (string | null)[];
  bagItems: BagItem[];
  maxBagSlots: number;
}

export interface AmmoState {
  current: number;
  reserve: number;
  weaponName: string;
  showAmmo: boolean;
}

const { scoreStore, gameStateStore, ammoStore, playerHealthStore, inventoryStore } = initStores();

export { scoreStore, gameStateStore, ammoStore, playerHealthStore, inventoryStore };
