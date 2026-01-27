import { IGameRule } from './IGameRule';
import { Game } from '../game/Game';
import { PlayerPawn } from '../pawns/PlayerPawn';
import { gameStateStore } from '../store/GameStore';
import { UIScreen } from '../../ui/UIManager';

export class SurvivalRule implements IGameRule {
  private game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  public onStart(): void {
    console.log('[SurvivalRule] Game Started (Survival Mode)');
    // 리셋 로직 등
  }

  public onUpdate(_deltaTime: number): void {
    // 생존 모드: 특별한 업데이트 로직 없음 (적 웨이브 등은 별도 매니저가 처리한다고 가정)
    // 추후 타임 리미트나 승리 조건 체크 가능
  }

  public onPlayerDied(player: PlayerPawn): void {
    console.log(`[SurvivalRule] Player died: ${player.id}`);

    // Game.ts에 있던 Game Over 처리 로직을 이곳으로 이동

    // 게임 일시정지 상태로 변경 (Game 클래스에서 public setter 필요)
    this.game.setPaused(true);

    // 상태 스토어 업데이트
    gameStateStore.set('GAME_OVER');

    // UI 업데이트
    if (this.game.uiManager) {
      this.game.uiManager.setGameOverUI(true);
      this.game.uiManager.showScreen(UIScreen.PAUSE);
      this.game.uiManager.exitPointerLock();
    }
  }

  public checkWinCondition(): boolean {
    // 생존 모드는 승리가 없음 (무한) 또는 특정 시간 버티기?
    // 현재는 False 반환
    return false;
  }

  public dispose(): void {
    // 정리 로직
  }
}
