import { LogLevel, Logger as AnteLogger } from '@ante/common';
import { Logger as BabylonLogger } from '@babylonjs/core/Misc/logger';

export function toBabylonLogLevels(level: LogLevel): number {
  switch (level) {
    case LogLevel.DEBUG:
    case LogLevel.INFO:
      return BabylonLogger.AllLogLevel;
    case LogLevel.WARN:
      return BabylonLogger.WarningLogLevel | BabylonLogger.ErrorLogLevel;
    case LogLevel.ERROR:
      return BabylonLogger.ErrorLogLevel;
    case LogLevel.NONE:
      return BabylonLogger.NoneLogLevel;
    default:
      return BabylonLogger.AllLogLevel;
  }
}

export function syncBabylonLoggerWithAnte(): void {
  BabylonLogger.LogLevels = toBabylonLogLevels(AnteLogger.getGlobalLevel());
}
