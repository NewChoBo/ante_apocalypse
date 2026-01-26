import { IPawn } from '../../types/IPawn';
import { ITickable } from '../interfaces/ITickable';
import { TickManager } from '../managers/TickManager';

/**
 * Unreal의 Controller 개념을 도입한 추상 클래스.
 * Pawn을 조종하는 '뇌' 역할을 수행합니다.
 */
export abstract class BaseController implements ITickable {
  public id: string;
  public readonly priority = 10;
  protected possessedPawn: IPawn | null = null;

  constructor(id: string) {
    this.id = id;
    // TickManager에 자동 등록
    TickManager.getInstance().register(this);
  }

  /** ITickable 인터페이스 구현 (하위 클래스에서 상속받아 구현) */
  public abstract tick(deltaTime: number): void;

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

  /** 리소스 해제 시 호출 (필요한 경우) */
  public dispose(): void {
    TickManager.getInstance().unregister(this);
  }
}
