import { GameEvents } from '../IEventBus.ts';

/**
 * 게임 코어(상태, 점수, 설정) 관련 이벤트 페이로드 정의
 */
export interface CoreEventMap {
  [GameEvents.GAME_START]: void;
  [GameEvents.GAME_PAUSE]: void;
  [GameEvents.GAME_RESUME]: void;
  [GameEvents.GAME_OVER]: { score: number; reason: string };
  [GameEvents.SCORE_CHANGED]: { newScore: number };
  [GameEvents.SETTINGS_CHANGED]: { key: string; value: string | number | boolean | object };
  [GameEvents.LOCALE_CHANGED]: { locale: string };
}
