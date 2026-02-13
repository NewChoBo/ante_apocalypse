import { EventCode } from './NetworkProtocol.js';

const REQUEST_EVENT_CODES = new Set<number>([
  EventCode.MOVE,
  EventCode.FIRE,
  EventCode.SYNC_WEAPON,
  EventCode.RELOAD,
  EventCode.REQUEST_HIT,
  EventCode.REQ_INITIAL_STATE,
]);

export function isRequestEventCode(code: number): boolean {
  return REQUEST_EVENT_CODES.has(code);
}

