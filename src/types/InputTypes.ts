export enum InputAction {
  MOVE_FORWARD = 'MOVE_FORWARD',
  MOVE_BACKWARD = 'MOVE_BACKWARD',
  MOVE_LEFT = 'MOVE_LEFT',
  MOVE_RIGHT = 'MOVE_RIGHT',
  JUMP = 'JUMP',
  SPRINT = 'SPRINT',
  CROUCH = 'CROUCH',
  FIRE = 'FIRE',
  AIM = 'AIM',
  RELOAD = 'RELOAD',
  SLOT_1 = 'SLOT_1',
  SLOT_2 = 'SLOT_2',
  SLOT_3 = 'SLOT_3',
  SLOT_4 = 'SLOT_4',
  INVENTORY = 'INVENTORY',
  INSPECTOR = 'INSPECTOR',
  DEBUG_HEALTH = 'DEBUG_HEALTH',
  DEBUG_AMMO = 'DEBUG_AMMO',
}

export interface InputMapping {
  keyboard: Record<string, InputAction>;
  mouse: Record<number, InputAction>;
}

export type InputState = Record<InputAction, boolean>;
