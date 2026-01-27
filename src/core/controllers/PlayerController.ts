import { BaseController } from './BaseController';
import { IPawn } from '../../types/IPawn';
import { InputComponent, InputState } from '../components/input/InputComponent';
import { InputManager } from '../input/InputManager';
import { InputAction } from '../../types/InputTypes';

export class PlayerController extends BaseController {
  private inputManager: InputManager;
  private mouseDelta = { x: 0, y: 0 };
  private canvas: HTMLCanvasElement;
  private isInputBlocked = false;

  constructor(id: string, canvas: HTMLCanvasElement) {
    super(id);
    this.canvas = canvas;
    this.inputManager = InputManager.getInstance();
    this.setupInputEvents();
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (document.pointerLockElement === this.canvas) {
      this.mouseDelta.x += e.movementX;
      this.mouseDelta.y += e.movementY;
    }
  };

  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  private setupInputEvents(): void {
    document.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  public dispose(): void {
    super.dispose();
    document.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
  }

  private getActionState(): Partial<InputState> {
    return {
      [InputAction.MOVE_FORWARD]: this.inputManager.isActionActive(InputAction.MOVE_FORWARD),
      [InputAction.MOVE_BACKWARD]: this.inputManager.isActionActive(InputAction.MOVE_BACKWARD),
      [InputAction.MOVE_LEFT]: this.inputManager.isActionActive(InputAction.MOVE_LEFT),
      [InputAction.MOVE_RIGHT]: this.inputManager.isActionActive(InputAction.MOVE_RIGHT),
      [InputAction.SPRINT]: this.inputManager.isActionActive(InputAction.SPRINT),
      [InputAction.JUMP]: this.inputManager.isActionActive(InputAction.JUMP),
      [InputAction.CROUCH]: this.inputManager.isActionActive(InputAction.CROUCH),
      [InputAction.AIM]: this.inputManager.isActionActive(InputAction.AIM),
      [InputAction.FIRE]: this.inputManager.isActionActive(InputAction.FIRE),
      [InputAction.RELOAD]: this.inputManager.isActionActive(InputAction.RELOAD),
      [InputAction.SLOT_1]: this.inputManager.isActionActive(InputAction.SLOT_1),
      [InputAction.SLOT_2]: this.inputManager.isActionActive(InputAction.SLOT_2),
      [InputAction.SLOT_3]: this.inputManager.isActionActive(InputAction.SLOT_3),
      [InputAction.SLOT_4]: this.inputManager.isActionActive(InputAction.SLOT_4),
    };
  }

  protected onPossess(pawn: IPawn): void {
    console.log(`[PlayerController] Possessing pawn: ${pawn.id}`);
    pawn.setupInput(true);
  }

  protected onUnpossess(pawn: IPawn): void {
    console.log(`[PlayerController] Unpossessing pawn: ${pawn.id}`);
    pawn.setupInput(false);
  }

  public setInputBlocked(blocked: boolean): void {
    this.isInputBlocked = blocked;
    if (blocked) {
      // 입력 차단 시 모든 키 해제
      this.inputManager.reset();
      this.mouseDelta.x = 0;
      this.mouseDelta.y = 0;
    }
  }

  public tick(_deltaTime: number): void {
    if (!this.possessedPawn || this.isInputBlocked) {
      this.inputManager.update(); // Still update to clear "justPressed"
      return;
    }

    // Pawn의 InputComponent 업데이트
    if (this.possessedPawn) {
      const inputComp = this.possessedPawn.getComponent(InputComponent);
      if (inputComp instanceof InputComponent) {
        inputComp.updateInput(this.getActionState(), this.mouseDelta);
      }
    }

    // Update InputManager state (copy current to previous)
    this.inputManager.update();

    // 델타값 초기화
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
  }
}
