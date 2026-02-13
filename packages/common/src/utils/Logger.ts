declare const process: {
  versions?: { node?: unknown };
  env?: Record<string, string | undefined>;
};

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export class Logger {
  private static globalLevel: LogLevel = Logger.resolveInitialLevel();
  private static isNode =
    typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private static parseLogLevel(value: string | undefined): LogLevel | undefined {
    if (!value) return undefined;
    switch (value.trim().toLowerCase()) {
      case 'debug':
      case '0':
        return LogLevel.DEBUG;
      case 'info':
      case '1':
        return LogLevel.INFO;
      case 'warn':
      case 'warning':
      case '2':
        return LogLevel.WARN;
      case 'error':
      case '3':
        return LogLevel.ERROR;
      case 'none':
      case 'off':
      case 'silent':
      case '4':
        return LogLevel.NONE;
      default:
        return undefined;
    }
  }

  private static resolveLevelFromEnvironment(env: Record<string, string | undefined>): LogLevel {
    const explicit = Logger.parseLogLevel(env.ANTE_LOG_LEVEL ?? env.LOG_LEVEL);
    if (explicit !== undefined) return explicit;

    const nodeEnv = env.NODE_ENV?.toLowerCase();
    const isTest = nodeEnv === 'test' || env.VITEST === 'true' || env.VITEST_WORKER_ID !== undefined;
    if (isTest) return LogLevel.WARN;

    if (nodeEnv === 'production') return LogLevel.WARN;
    return LogLevel.INFO;
  }

  private static readProcessEnv(): Record<string, string | undefined> {
    if (typeof process === 'undefined' || process.env == null) return {};
    return process.env;
  }

  private static resolveInitialLevel(): LogLevel {
    return Logger.resolveLevelFromEnvironment(Logger.readProcessEnv());
  }

  public static configureFromEnvironment(env?: Record<string, string | undefined>): void {
    Logger.globalLevel = Logger.resolveLevelFromEnvironment(env ?? Logger.readProcessEnv());
  }

  public static getGlobalLevel(): LogLevel {
    return Logger.globalLevel;
  }

  public static setGlobalLevel(level: LogLevel): void {
    Logger.globalLevel = level;
  }

  private getTimestamp(): string {
    const now = new Date();
    return now.toISOString();
  }

  private colorize(text: string, colorCode: string): string {
    if (!Logger.isNode) return text;
    return `\x1b[${colorCode}m${text}\x1b[0m`;
  }

  private formatMessage(level: string, message: string, colorCode: string): string {
    const timestamp = this.colorize(this.getTimestamp(), '90'); // Gray
    const levelLabel = this.colorize(level.padEnd(5), colorCode);
    const contextLabel = this.colorize(`[${this.context}]`, '36'); // Cyan
    return `${timestamp} ${levelLabel} ${contextLabel} ${message}`;
  }

  public debug(message: string, ...args: unknown[]): void {
    if (Logger.globalLevel <= LogLevel.DEBUG) {
      // eslint-disable-next-line no-console
      console.debug(this.formatMessage('DEBUG', message, '94'), ...args); // Bright Blue
    }
  }

  public info(message: string, ...args: unknown[]): void {
    if (Logger.globalLevel <= LogLevel.INFO) {
      // eslint-disable-next-line no-console
      console.info(this.formatMessage('INFO', message, '32'), ...args); // Green
    }
  }

  public warn(message: string, ...args: unknown[]): void {
    if (Logger.globalLevel <= LogLevel.WARN) {
      // eslint-disable-next-line no-console
      console.warn(this.formatMessage('WARN', message, '33'), ...args); // Yellow
    }
  }

  public error(message: string, ...args: unknown[]): void {
    if (Logger.globalLevel <= LogLevel.ERROR) {
      // eslint-disable-next-line no-console
      console.error(this.formatMessage('ERROR', message, '31'), ...args); // Red
    }
  }

  public log(message: string, ...args: unknown[]): void {
    this.info(message, ...args);
  }
}
