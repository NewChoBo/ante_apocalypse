import { atom, map } from 'nanostores';

/**
 * 게임의 전역 점수 저장소
 */
export const scoreStore = atom<number>(0);

/**
 * 게임 상태 저장소 (READY, PLAYING, PAUSED, GAME_OVER)
 */
export const gameStateStore = atom<'READY' | 'PLAYING' | 'PAUSED' | 'GAME_OVER'>('READY');

/**
 * 현재 선택된 무기의 탄약 정보 저장소
 */
export interface AmmoState {
  current: number;
  reserve: number;
  weaponName: string;
  showAmmo: boolean;
}

export const ammoStore = map<AmmoState>({
  current: 0,
  reserve: 0,
  weaponName: 'None',
  showAmmo: true,
});

/**
 * 플레이어 체력 저장소 (0~100)
 */
export const playerHealthStore = atom<number>(100);

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
  weaponSlots: (string | null)[]; // 1, 2, 3, 4번 슬롯에 장착된 무기 ID
  bagItems: BagItem[]; // 소비형 아이템들
  maxBagSlots: number;
}

export const inventoryStore = map<InventoryState>({
  weaponSlots: [null, null, null, null],
  bagItems: [],
  maxBagSlots: 16,
});
