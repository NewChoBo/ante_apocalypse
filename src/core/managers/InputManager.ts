export class InputManager {
  private keys: Record<string, boolean> = {};
  private mouseButtons: Record<number, boolean> = {};
  private static instance: InputManager;

  private constructor() {
    window.addEventListener('keydown', (e) => (this.keys[e.code] = true));
    window.addEventListener('keyup', (e) => (this.keys[e.code] = false));
    window.addEventListener('mousedown', (e) => (this.mouseButtons[e.button] = true));
    window.addEventListener('mouseup', (e) => (this.mouseButtons[e.button] = false));
  }

  public static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager();
    }
    return InputManager.instance;
  }

  public isKeyDown(code: string): boolean {
    return !!this.keys[code];
  }

  public isMouseButtonDown(button: number): boolean {
    return !!this.mouseButtons[button];
  }
}
