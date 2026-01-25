import { AdvancedDynamicTexture } from '@babylonjs/gui';
import { Scene } from '@babylonjs/core';

export class UIManager {
  private static instance: UIManager;
  public ui: AdvancedDynamicTexture;

  private constructor(scene: Scene) {
    this.ui = AdvancedDynamicTexture.CreateFullscreenUI('UI', true, scene);
  }

  public static initialize(scene: Scene): UIManager {
    if (UIManager.instance) {
      UIManager.instance.dispose();
    }
    UIManager.instance = new UIManager(scene);
    return UIManager.instance;
  }

  public static getInstance(): UIManager {
    if (!UIManager.instance) {
      throw new Error('UIManager not initialized. Call initialize() first.');
    }
    return UIManager.instance;
  }

  public getTexture(): AdvancedDynamicTexture {
    return this.ui;
  }

  public dispose(): void {
    this.ui.dispose();
  }
}
