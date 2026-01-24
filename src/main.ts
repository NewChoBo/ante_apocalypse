import { Game } from './core/Game';

// 게임 인스턴스 생성 및 시작
const game = new Game('game-container');

// DOM 요소 연결
const startButton = document.getElementById('start-button');
const resumeButton = document.getElementById('resume-button');

startButton?.addEventListener('click', () => {
  game.start();
});

resumeButton?.addEventListener('click', () => {
  game.resume();
});

const menuButton = document.getElementById('menu-button');
menuButton?.addEventListener('click', () => {
  game.quitToMenu();
});

// ESC 키로 일시정지/재개
document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    game.togglePause();
  }
});
