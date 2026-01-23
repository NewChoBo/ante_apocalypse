import { GameEvents } from '../IEventBus.ts';

/**
 * 무기 관련 이벤트 페이로드 정의
 */
export interface WeaponEventMap {
  [GameEvents.WEAPON_FIRE]: { weaponId: string; ammoRemaining: number };
  [GameEvents.WEAPON_RELOAD]: { weaponId: string };
  [GameEvents.WEAPON_AMMO_CHANGED]: { weaponId: string; current: number; reserve: number };
}
