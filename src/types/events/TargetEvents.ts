import { GameEvents } from '../IEventBus.ts';

/**
 * 타겟 관련 이벤트 페이로드 정의
 */
export interface TargetEventMap {
  [GameEvents.TARGET_DESTROYED]: { targetId: string; points: number };
}
