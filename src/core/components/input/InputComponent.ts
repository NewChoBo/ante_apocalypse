import { Scene } from '@babylonjs/core';
import { BaseComponent } from '../base/BaseComponent';
import { IPawn } from '../../../types/IPawn';

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
  crouch: boolean;
  aim: boolean;
  fire: boolean;
  reload: boolean;
  slot1: boolean;
  slot2: boolean;
  slot3: boolean;
  slot4: boolean;
}

export interface MouseDelta {
  x: number;
  y: number;
}

const INITIAL_INPUT_STATE: InputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false,
  jump: false,
  crouch: false,
  aim: false,
  fire: false,
  reload: false,
  slot1: false,
  slot2: false,
  slot3: false,
  slot4: false,
};

export class InputComponent extends BaseComponent {
  public name = 'Input';

  private _currentState: InputState = { ...INITIAL_INPUT_STATE };
  private _previousState: InputState = { ...INITIAL_INPUT_STATE };

  private _mouseDelta: MouseDelta = { x: 0, y: 0 };

  constructor(owner: IPawn, scene: Scene) {
    super(owner, scene);
  }

  public updateInput(keys: Partial<InputState>, mouseDelta?: MouseDelta): void {
    // Save current to previous
    Object.assign(this._previousState, this._currentState);

    // Update current
    Object.assign(this._currentState, keys);

    if (mouseDelta) {
      this._mouseDelta.x += mouseDelta.x;
      this._mouseDelta.y += mouseDelta.y;
    }
  }

  public get state(): Readonly<InputState> {
    return this._currentState;
  }

  public get previousState(): Readonly<InputState> {
    return this._previousState;
  }

  /** Returns true if button was just pressed this frame */
  public isButtonDown(key: keyof InputState): boolean {
    return this._currentState[key] && !this._previousState[key];
  }

  /** Returns true if button was just released this frame */
  public isButtonUp(key: keyof InputState): boolean {
    return !this._currentState[key] && this._previousState[key];
  }

  public get mouseDelta(): Readonly<MouseDelta> {
    return this._mouseDelta;
  }

  public consumeMouseDelta(): MouseDelta {
    const delta = { ...this._mouseDelta };
    this._mouseDelta.x = 0;
    this._mouseDelta.y = 0;
    return delta;
  }

  public update(_deltaTime: number): void {
    // Logic handles in updateInput
  }
}
