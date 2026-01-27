import { InputAction, InputMapping, InputState } from '../../types/InputTypes';
import defaultMappings from '../../config/input_mappings.json';

export class InputManager {
  private static instance: InputManager;
  public mappings: InputMapping = { keyboard: {}, mouse: {} };
  private actionState: InputState;
  private previousActionState: InputState;

  private constructor() {
    this.mappings = defaultMappings as unknown as InputMapping;
    this.actionState = this.createInitialState();
    this.previousActionState = this.createInitialState();
    this.setupListeners();
  }

  public static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager();
    }
    return InputManager.instance;
  }

  private createInitialState(): InputState {
    const state = {} as Partial<InputState>;
    Object.values(InputAction).forEach((action) => {
      state[action as InputAction] = false;
    });
    return state as InputState;
  }

  private setupListeners(): void {
    window.addEventListener('keydown', (e) => this.handleKeyboard(e.code, true));
    window.addEventListener('keyup', (e) => this.handleKeyboard(e.code, false));
    window.addEventListener('mousedown', (e) => this.handleMouse(e.button, true));
    window.addEventListener('mouseup', (e) => this.handleMouse(e.button, false));
  }

  private handleKeyboard(code: string, isPressed: boolean): void {
    const action = this.mappings.keyboard[code];
    if (action) {
      this.actionState[action] = isPressed;
    }
  }

  private handleMouse(button: number, isPressed: boolean): void {
    const action = this.mappings.mouse[button];
    if (action) {
      this.actionState[action] = isPressed;
    }
  }

  public update(): void {
    // Copy current to previous for "just pressed" checks
    Object.assign(this.previousActionState, this.actionState);
  }

  public isActionActive(action: InputAction): boolean {
    return this.actionState[action];
  }

  public isActionJustPressed(action: InputAction): boolean {
    return this.actionState[action] && !this.previousActionState[action];
  }

  public isActionJustReleased(action: InputAction): boolean {
    return !this.actionState[action] && this.previousActionState[action];
  }

  public reset(): void {
    Object.keys(this.actionState).forEach((key) => {
      this.actionState[key as InputAction] = false;
      this.previousActionState[key as InputAction] = false;
    });
  }
}
