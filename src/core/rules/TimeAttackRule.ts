import { IGameRule } from './IGameRule';
import { Game } from '../game/Game';
import { PlayerPawn } from '../pawns/PlayerPawn';
import { UIScreen } from '../../ui/UIManager';
import { gameStateStore, scoreStore } from '../store/GameStore';

export class TimeAttackRule implements IGameRule {
  private game: Game;
  private timeLimit: number = 60; // 60 seconds
  private targetScore: number = 500;
  private currentTime: number = 0;
  private gameEnded: boolean = false;

  constructor(game: Game) {
    this.game = game;
  }

  public onStart(): void {
    this.currentTime = this.timeLimit;
    this.gameEnded = false;
    // Reset score
    scoreStore.set(0);

    console.log(
      `[TimeAttackRule] Game Started! Target: ${this.targetScore} points in ${this.timeLimit}s`
    );
  }

  public onUpdate(deltaTime: number): void {
    if (this.gameEnded) return;

    this.currentTime -= deltaTime;

    if (Math.floor(this.currentTime) % 10 === 0) {
      // Debug log every ~10s or per frame if needed, but let's keep it clean
      // Actually 10s log might be tricky with float, so just per second:
    }

    // 임시 디버깅용: 남은 시간 정수 출력 (매 초마다 바뀔 때만 찍어도 좋지만 간단히)
    // console.log(`Time Left: ${this.currentTime.toFixed(1)}`);

    if (this.currentTime <= 0) {
      this.handleGameOver(false); // Time Over -> Fail
    } else {
      if (this.checkWinCondition()) {
        this.handleGameOver(true); // Win
      }
    }
  }

  public onPlayerDied(player: PlayerPawn): void {
    console.log(`[TimeAttackRule] Player died: ${player.id}`);
    this.handleGameOver(false); // Death -> Fail
  }

  public checkWinCondition(): boolean {
    const currentScore = scoreStore.get();
    return currentScore >= this.targetScore;
  }

  private handleGameOver(isWin: boolean): void {
    if (this.gameEnded) return;
    this.gameEnded = true;

    this.game.setPaused(true);
    gameStateStore.set('GAME_OVER');

    if (this.game.uiManager) {
      // 메시지 설정 (임시로 콘솔만, UI Manager에 메서드 추가 필요할 수 있음)
      console.log(isWin ? 'MISSION ACCOMPLISHED!' : 'MISSION FAILED!');

      this.game.uiManager.setGameOverUI(true); // GameOver UI 재활용
      this.game.uiManager.showScreen(UIScreen.PAUSE);
      this.game.uiManager.exitPointerLock();
    }
  }

  public dispose(): void {
    this.gameEnded = true;
  }
}
