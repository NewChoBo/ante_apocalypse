import { LogLevel, Logger } from '@ante/common';
import { Game } from './core/Game';

Logger.configureFromEnvironment({
  NODE_ENV: import.meta.env.MODE,
  ANTE_LOG_LEVEL: import.meta.env.VITE_LOG_LEVEL,
});

if (import.meta.env.PROD && import.meta.env.VITE_LOG_LEVEL == null) {
  Logger.setGlobalLevel(LogLevel.WARN);
}

// 게임 인스턴스 생성 및 시작
new Game();

// ESC 키로 일시정지/재개
