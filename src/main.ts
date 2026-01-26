import { Game } from './core/game/Game';

// 게임 인스턴스 생성 및 시작
const game = new Game();

// ESC 키로 일시정지/재개
document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    game.togglePause();
  }
});
