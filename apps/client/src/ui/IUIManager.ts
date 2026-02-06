import { AdvancedDynamicTexture } from '@babylonjs/gui';
import { Observable } from '@babylonjs/core';
import { UIScreen } from './UIManager';

export interface IUIManager {
  readonly onLogin: Observable<string>;
  readonly onStartMultiplayer: Observable<void>;
  readonly onLogout: Observable<void>;
  readonly onResume: Observable<void>;
  readonly onAbort: Observable<void>;
  readonly currentScreen: UIScreen;

  getTexture(): AdvancedDynamicTexture;
  showScreen(screen: UIScreen): void;
  getSelectedMap(): string;
  requestPointerLock(): void;
  exitPointerLock(): void;
  showNotification(message: string): void;
  dispose(): void;
}
