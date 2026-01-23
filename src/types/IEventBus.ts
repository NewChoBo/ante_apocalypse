import { WeaponEventMap } from './events/WeaponEvents.ts';
import { TargetEventMap } from './events/TargetEvents.ts';
import { CoreEventMap } from './events/CoreEvents.ts';

/**
 * 프로젝트의 모든 독립적인 이벤트 맵들을 하나로 통합합니다.
 * 이 방식은 유지보수성과 확장성을 높이며 파일 간 순환 참조를 방지합니다.
 */
export interface EventMap extends WeaponEventMap, TargetEventMap, CoreEventMap {}

/**
 * 이벤트 핸들러 콜백의 타입 정의.
 */
export type EventCallback<K extends keyof EventMap> = (data: EventMap[K]) => void;

/**
 * 시스템 간 통신을 위한 Type-safe EventBus 인터페이스.
 */
export interface IEventBus {
  /** 이벤트 구독 */
  on<K extends keyof EventMap>(eventName: K, callback: EventCallback<K>): void;

  /** 이벤트 한 번만 구독 */
  once<K extends keyof EventMap>(eventName: K, callback: EventCallback<K>): void;

  /** 이벤트 발행 */
  emit<K extends keyof EventMap>(eventName: K, data: EventMap[K]): void;

  /** 구독 해제 */
  off<K extends keyof EventMap>(eventName: K, callback: EventCallback<K>): void;
}

/**
 * 프로젝트 내 표준 이벤트 이름 정의
 */
export enum GameEvents {
  // 무기 관련
  WEAPON_FIRE = 'weapon:fire',
  WEAPON_RELOAD = 'weapon:reload',
  WEAPON_AMMO_CHANGED = 'weapon:ammoChanged',

  // 게임 상태 관련
  GAME_START = 'game:start',
  GAME_PAUSE = 'game:pause',
  GAME_RESUME = 'game:resume',
  GAME_OVER = 'game:over',

  // 점수 및 진행도
  SCORE_CHANGED = 'score:changed',
  TARGET_DESTROYED = 'target:destroyed',

  // UI/설정
  SETTINGS_CHANGED = 'settings:changed',
  LOCALE_CHANGED = 'locale:changed',
}
