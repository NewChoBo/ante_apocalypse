import { describe, expect, it } from 'vitest';
import {
  EventCode,
  getTransportEventKind,
  isRequestEventCode,
  isTransportEventCode,
  REQUEST_EVENT_CODES,
  AUTHORITY_EVENT_CODES,
  SYSTEM_EVENT_CODES,
} from '../index.js';

describe('NetworkEventRouting', () => {
  it('classifies all request event codes as request', () => {
    for (const code of REQUEST_EVENT_CODES) {
      expect(getTransportEventKind(code)).toBe('request');
      expect(isRequestEventCode(code)).toBe(true);
      expect(isTransportEventCode(code)).toBe(true);
    }
  });

  it('classifies authority and system event codes', () => {
    for (const code of AUTHORITY_EVENT_CODES) {
      expect(getTransportEventKind(code)).toBe('authority');
      expect(isRequestEventCode(code)).toBe(false);
      expect(isTransportEventCode(code)).toBe(true);
    }

    for (const code of SYSTEM_EVENT_CODES) {
      expect(getTransportEventKind(code)).toBe('system');
      expect(isRequestEventCode(code)).toBe(false);
      expect(isTransportEventCode(code)).toBe(true);
    }
  });

  it('returns null/false for unknown event code', () => {
    expect(getTransportEventKind(99999)).toBeNull();
    expect(isRequestEventCode(99999)).toBe(false);
    expect(isTransportEventCode(99999)).toBe(false);
  });

  it('keeps REQ_INITIAL_STATE in request domain', () => {
    expect(getTransportEventKind(EventCode.REQ_INITIAL_STATE)).toBe('request');
    expect(isRequestEventCode(EventCode.REQ_INITIAL_STATE)).toBe(true);
  });
});
