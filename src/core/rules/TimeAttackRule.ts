import { IGameRule } from './IGameRule';
import { Game } from '../game/Game';
import { PlayerPawn } from '../pawns/PlayerPawn';
import { UIScreen } from '../../ui/UIManager';
import { gameStateStore, scoreStore, gameTimerStore } from '../store/GameStore';

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

    // Format time MM:SS
    const minutes = Math.floor(this.currentTime / 60);
    const seconds = Math.floor(this.currentTime % 60);
    const formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    gameTimerStore.set(formatted);

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

      this.game.uiManager.setGameOverUI(true, isWin ? 'MISSION ACCOMPLISHED!' : 'MISSION FAILED');
      this.game.uiManager.showScreen(UIScreen.PAUSE);
      this.game.uiManager.exitPointerLock();
    }
  }

  public dispose(): void {
    this.gameEnded = true;
    gameTimerStore.set('00:00');
  }
}
