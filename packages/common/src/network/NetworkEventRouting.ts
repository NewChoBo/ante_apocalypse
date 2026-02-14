import { EventCode } from './NetworkProtocol.js';

export type TransportEventKind = 'request' | 'authority' | 'system';

export const REQUEST_EVENT_CODES = [
  EventCode.MOVE,
  EventCode.FIRE,
  EventCode.SYNC_WEAPON,
  EventCode.RELOAD,
  EventCode.REQUEST_HIT,
  EventCode.REQ_INITIAL_STATE,
  EventCode.UPGRADE_PICK,
] as const;

export const AUTHORITY_EVENT_CODES = [
  EventCode.HIT,
  EventCode.ENEMY_MOVE,
  EventCode.ENEMY_HIT,
  EventCode.TARGET_HIT,
  EventCode.TARGET_DESTROY,
  EventCode.SPAWN_TARGET,
  EventCode.INITIAL_STATE,
  EventCode.DESTROY_ENEMY,
  EventCode.DESTROY_PICKUP,
  EventCode.PLAYER_DEATH,
  EventCode.WEAPON_CONFIGS,
  EventCode.RESPAWN,
  EventCode.GAME_END,
  EventCode.WAVE_STATE,
  EventCode.UPGRADE_OFFER,
  EventCode.UPGRADE_APPLY,
] as const;

export const SYSTEM_EVENT_CODES = [
  EventCode.JOIN,
  EventCode.LEAVE,
  EventCode.ANIM_STATE,
  EventCode.MAP_SYNC,
  EventCode.SPAWN_ENEMY,
  EventCode.SPAWN_PICKUP,
  EventCode.REQ_WEAPON_CONFIGS,
] as const;

export type RequestEventCode = (typeof REQUEST_EVENT_CODES)[number];
export type AuthorityEventCode = (typeof AUTHORITY_EVENT_CODES)[number];
export type SystemEventCode = (typeof SYSTEM_EVENT_CODES)[number];
export type TransportEventCode = RequestEventCode | AuthorityEventCode | SystemEventCode;

const REQUEST_EVENT_CODE_SET = new Set<number>(REQUEST_EVENT_CODES);
const AUTHORITY_EVENT_CODE_SET = new Set<number>(AUTHORITY_EVENT_CODES);
const SYSTEM_EVENT_CODE_SET = new Set<number>(SYSTEM_EVENT_CODES);

export function getTransportEventKind(code: number): TransportEventKind | null {
  if (REQUEST_EVENT_CODE_SET.has(code)) return 'request';
  if (AUTHORITY_EVENT_CODE_SET.has(code)) return 'authority';
  if (SYSTEM_EVENT_CODE_SET.has(code)) return 'system';
  return null;
}

export function isTransportEventCode(code: number): code is TransportEventCode {
  return getTransportEventKind(code) !== null;
}

export function isRequestEventCode(code: number): code is RequestEventCode {
  return REQUEST_EVENT_CODE_SET.has(code);
}
