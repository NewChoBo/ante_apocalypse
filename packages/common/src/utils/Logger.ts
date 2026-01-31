declare let process: any;

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export class Logger {
  private static globalLevel: LogLevel = LogLevel.INFO;
  private static isNode =
    typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  public static setGlobalLevel(level: LogLevel) {
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

  public debug(message: string, ...args: any[]): void {
    if (Logger.globalLevel <= LogLevel.DEBUG) {
      // eslint-disable-next-line no-console
      console.debug(this.formatMessage('DEBUG', message, '94'), ...args); // Bright Blue
    }
  }

  public info(message: string, ...args: any[]): void {
    if (Logger.globalLevel <= LogLevel.INFO) {
      // eslint-disable-next-line no-console
      console.info(this.formatMessage('INFO', message, '32'), ...args); // Green
    }
  }

  public warn(message: string, ...args: any[]): void {
    if (Logger.globalLevel <= LogLevel.WARN) {
      // eslint-disable-next-line no-console
      console.warn(this.formatMessage('WARN', message, '33'), ...args); // Yellow
    }
  }

  public error(message: string, ...args: any[]): void {
    if (Logger.globalLevel <= LogLevel.ERROR) {
      // eslint-disable-next-line no-console
      console.error(this.formatMessage('ERROR', message, '31'), ...args); // Red
    }
  }

  public log(message: string, ...args: any[]): void {
    this.info(message, ...args);
  }
}
