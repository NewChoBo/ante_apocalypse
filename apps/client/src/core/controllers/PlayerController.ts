import { BaseController } from './BaseController';
import { IPawn } from '../../types/IPawn';
import { PlayerPawn } from '../PlayerPawn';
import { TickManager } from '../TickManager';

/**
 * 실제 플레이어의 입력을 처리하는 컨트롤러.
 */
export class PlayerController extends BaseController {
  private keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
    crouch: false,
    aim: false,
  };

  private mouseDelta = { x: 0, y: 0 };
  private canvas: HTMLCanvasElement;
  private isInputBlocked = false;

  constructor(id: string, canvas: HTMLCanvasElement, tickManager: TickManager) {
    super(id, tickManager);
    this.canvas = canvas;
    this.setupInputEvents();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    // 포인터가 잠겨있을 때 (게임 플레이 중)
    if (document.pointerLockElement === this.canvas) {
      // 브라우저 단축키 차단 (Ctrl+D, Ctrl+S, Ctrl+W 등)
      if (e.ctrlKey || e.metaKey || e.key === 'Tab') {
        // 디버깅용 F12/Ctrl+Shift+I 등은 허용 (필요 시 수정)
        if (e.key !== 'F12' && !(e.ctrlKey && e.shiftKey && e.key === 'I')) {
          e.preventDefault();
        }
      }
    }
    this.updateKeyState(e.code, true);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.updateKeyState(e.code, false);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (document.pointerLockElement === this.canvas) {
      this.mouseDelta.x += e.movementX;
      this.mouseDelta.y += e.movementY;
    }
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) this.updateKeyState('MouseLeft', true);
    if (e.button === 2) this.updateKeyState('MouseRight', true);
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.updateKeyState('MouseLeft', false);
    if (e.button === 2) this.updateKeyState('MouseRight', false);
  };

  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  private setupInputEvents(): void {
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);

    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  public dispose(): void {
    super.dispose();
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);

    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
  }

  private updateKeyState(code: string, isPressed: boolean): void {
    switch (code) {
      case 'KeyW':
        this.keys.forward = isPressed;
        break;
      case 'KeyS':
        this.keys.backward = isPressed;
        break;
      case 'KeyA':
        this.keys.left = isPressed;
        break;
      case 'KeyD':
        this.keys.right = isPressed;
        break;
      case 'ShiftLeft':
        this.keys.sprint = isPressed;
        break;
      case 'Space':
        this.keys.jump = isPressed;
        break;
      case 'ControlLeft':
        this.keys.crouch = isPressed;
        break;
      case 'MouseRight':
        this.keys.aim = isPressed;
        break;
    }
  }

  protected onPossess(_pawn: IPawn): void {
    // 빙의 시 추가 로직
  }

  protected onUnpossess(_pawn: IPawn): void {
    // 빙의 해제 시 추가 로직
  }

  public setInputBlocked(blocked: boolean): void {
    this.isInputBlocked = blocked;
    // Always clear keys when block state changes to prevent stuck inputs
    Object.keys(this.keys).forEach((k) => (this.keys[k as keyof typeof this.keys] = false));
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
  }

  public tick(deltaTime: number): void {
    if (!this.possessedPawn || this.isInputBlocked) return;

    // Pawn에게 입력 데이터 전달
    if (this.possessedPawn instanceof PlayerPawn) {
      this.possessedPawn.handleInput(this.keys, this.mouseDelta, deltaTime);
    }

    // 델타값 초기화
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
  }
}
