import { atom, map, WritableAtom, MapStore } from 'nanostores';

declare global {
  interface Window {
    __GAME_STORES__?: {
      scoreStore: WritableAtom<number>;
      gameStateStore: WritableAtom<'READY' | 'PLAYING' | 'PAUSED' | 'GAME_OVER'>;
      ammoStore: MapStore<AmmoState>;
      playerHealthStore: WritableAtom<number>;
      inventoryStore: MapStore<InventoryState>;
      gameTimerStore: WritableAtom<string>;
    };
  }
}

type GameStores = {
  scoreStore: WritableAtom<number>;
  gameStateStore: WritableAtom<'READY' | 'PLAYING' | 'PAUSED' | 'GAME_OVER'>;
  ammoStore: MapStore<AmmoState>;
  playerHealthStore: WritableAtom<number>;
  inventoryStore: MapStore<InventoryState>;
  gameTimerStore: WritableAtom<string>;
};

let localStores: GameStores | null = null;

function createStores(): GameStores {
  return {
    scoreStore: atom<number>(0),
    gameStateStore: atom<'READY' | 'PLAYING' | 'PAUSED' | 'GAME_OVER'>('READY'),
    ammoStore: map<AmmoState>({
      current: 0,
      reserve: 0,
      weaponName: 'None',
      showAmmo: true,
    }),
    playerHealthStore: atom<number>(100),
    inventoryStore: map<InventoryState>({
      weaponSlots: ['pistol', 'rifle', 'knife', 'bat'],
      bagItems: [
        { id: 'health_pack', name: 'First Aid Kit', type: 'consumable', count: 2 },
        { id: 'ammo_box', name: 'Ammo Crate', type: 'consumable', count: 1 },
        { id: 'ammo_generic', name: 'Generic Ammo', type: 'consumable', count: 5 },
      ],
      maxBagSlots: 24,
    }),
    gameTimerStore: atom<string>('00:00'),
  };
}

function initStores(): GameStores {
  // 1. If we already have local stores, return them (Singleton)
  if (localStores) {
    return localStores;
  }

  // 2. In DEV, try to pick up from window for HMR
  if (import.meta.env.DEV && window.__GAME_STORES__) {
    console.log('[GameStore] Reusing existing global stores from window (HMR)');
    localStores = window.__GAME_STORES__ as GameStores;
    return localStores;
  }

  // 3. Initialize new stores
  console.log('[GameStore] Initializing new stores');
  localStores = createStores();

  // 4. In DEV, expose to window for HMR
  if (import.meta.env.DEV) {
    window.__GAME_STORES__ = localStores;
  }

  return localStores;
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

const { scoreStore, gameStateStore, ammoStore, playerHealthStore, inventoryStore, gameTimerStore } =
  initStores();

export { scoreStore, gameStateStore, ammoStore, playerHealthStore, inventoryStore, gameTimerStore };
