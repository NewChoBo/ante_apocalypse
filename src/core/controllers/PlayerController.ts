import { BaseController } from './BaseController.ts';
import { IPawn } from '../../types/IPawn.ts';
import { PlayerPawn } from '../PlayerPawn.ts';

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

  constructor(id: string, canvas: HTMLCanvasElement) {
    super(id);
    this.canvas = canvas;
    this.setupInputEvents();
  }

  private setupInputEvents(): void {
    document.addEventListener('keydown', (e) => this.updateKeyState(e.code, true));
    document.addEventListener('keyup', (e) => this.updateKeyState(e.code, false));
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.canvas) {
        this.mouseDelta.x += e.movementX;
        this.mouseDelta.y += e.movementY;
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.updateKeyState('MouseLeft', true);
      if (e.button === 2) this.updateKeyState('MouseRight', true);
    });

    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.updateKeyState('MouseLeft', false);
      if (e.button === 2) this.updateKeyState('MouseRight', false);
    });

    // 우클릭 컨텍스트 메뉴 방지 (정조준 용)
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
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

  public tick(deltaTime: number): void {
    if (!this.possessedPawn) return;

    // Pawn에게 입력 데이터 전달
    if (this.possessedPawn instanceof PlayerPawn) {
      this.possessedPawn.handleInput(this.keys, this.mouseDelta, deltaTime);
    }

    // 델타값 초기화
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
  }
}
