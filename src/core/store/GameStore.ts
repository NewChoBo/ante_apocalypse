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
