import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger, LogLevel } from './Logger.js';

describe('Logger environment configuration', () => {
  afterEach(() => {
    Logger.setGlobalLevel(LogLevel.INFO);
    vi.restoreAllMocks();
  });

  it('uses explicit log level from ANTE_LOG_LEVEL first', () => {
    Logger.configureFromEnvironment({
      ANTE_LOG_LEVEL: 'debug',
      LOG_LEVEL: 'error',
      NODE_ENV: 'production',
    });

    expect(Logger.getGlobalLevel()).toBe(LogLevel.DEBUG);
  });

  it('uses LOG_LEVEL when ANTE_LOG_LEVEL is not provided', () => {
    Logger.configureFromEnvironment({
      LOG_LEVEL: 'none',
      NODE_ENV: 'development',
    });

    expect(Logger.getGlobalLevel()).toBe(LogLevel.NONE);
  });

  it('defaults to WARN in test environment', () => {
    Logger.configureFromEnvironment({
      NODE_ENV: 'test',
    });

    expect(Logger.getGlobalLevel()).toBe(LogLevel.WARN);
  });

  it('defaults to WARN in production environment', () => {
    Logger.configureFromEnvironment({
      NODE_ENV: 'production',
    });

    expect(Logger.getGlobalLevel()).toBe(LogLevel.WARN);
  });

  it('defaults to INFO in development when no explicit level exists', () => {
    Logger.configureFromEnvironment({
      NODE_ENV: 'development',
    });

    expect(Logger.getGlobalLevel()).toBe(LogLevel.INFO);
  });

  it('suppresses info logs when level is WARN', () => {
    Logger.setGlobalLevel(LogLevel.WARN);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    const logger = new Logger('LoggerTest');
    logger.info('hidden');

    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('emits error logs when level is WARN', () => {
    Logger.setGlobalLevel(LogLevel.WARN);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const logger = new Logger('LoggerTest');
    logger.error('visible');

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
