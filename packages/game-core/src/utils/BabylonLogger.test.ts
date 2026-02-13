import { LogLevel } from '@ante/common';
import { Logger as BabylonLogger } from '@babylonjs/core/Misc/logger';
import { describe, expect, it } from 'vitest';
import { toBabylonLogLevels } from './BabylonLogger.js';

describe('Babylon logger mapping', () => {
  it('maps DEBUG and INFO to all Babylon logs', () => {
    expect(toBabylonLogLevels(LogLevel.DEBUG)).toBe(BabylonLogger.AllLogLevel);
    expect(toBabylonLogLevels(LogLevel.INFO)).toBe(BabylonLogger.AllLogLevel);
  });

  it('maps WARN to warning+error Babylon logs', () => {
    const expected = BabylonLogger.WarningLogLevel | BabylonLogger.ErrorLogLevel;
    expect(toBabylonLogLevels(LogLevel.WARN)).toBe(expected);
  });

  it('maps ERROR and NONE to strict Babylon levels', () => {
    expect(toBabylonLogLevels(LogLevel.ERROR)).toBe(BabylonLogger.ErrorLogLevel);
    expect(toBabylonLogLevels(LogLevel.NONE)).toBe(BabylonLogger.NoneLogLevel);
  });
});
