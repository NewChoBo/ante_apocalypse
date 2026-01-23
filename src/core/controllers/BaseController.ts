import { IPawn } from '../../types/IPawn.ts';

/**
 * Unreal의 Controller 개념을 도입한 추상 클래스.
 * Pawn을 조종하는 '뇌' 역할을 수행합니다.
 */
export abstract class BaseController {
  public id: string;
  protected possessedPawn: IPawn | null = null;

  constructor(id: string) {
    this.id = id;
  }

  /** Pawn 빙의 */
  public possess(pawn: IPawn): void {
    if (this.possessedPawn) {
      this.unpossess();
    }
    this.possessedPawn = pawn;
    pawn.controllerId = this.id;
    this.onPossess(pawn);
  }

  /** Pawn 빙의 해제 */
  public unpossess(): void {
    if (this.possessedPawn) {
      this.possessedPawn.controllerId = null;
      this.onUnpossess(this.possessedPawn);
      this.possessedPawn = null;
    }
  }

  protected abstract onPossess(pawn: IPawn): void;
  protected abstract onUnpossess(pawn: IPawn): void;

  public abstract update(deltaTime: number): void;
}
