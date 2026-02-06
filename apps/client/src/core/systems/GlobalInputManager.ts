import { Scene } from '@babylonjs/core';
import { PlayerPawn } from '../PlayerPawn';
import { PlayerController } from '../controllers/PlayerController';
import { InventoryUI } from '../../ui/inventory/InventoryUI';
import { gameStateStore } from '../store/GameStore';
import { IUIManager } from '../../ui/IUIManager';
import { UIScreen } from '../../ui/UIManager';

export class GlobalInputManager {
  private scene: Scene | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private playerPawn: PlayerPawn | null = null;
  private playerController: PlayerController | null = null;
  private inventoryUI: InventoryUI | null = null;
  private uiManager: IUIManager;

  private isInitialized = false;

  constructor(uiManager: IUIManager) {
    this.uiManager = uiManager;
  }

  public initialize(
    scene: Scene,
    canvas: HTMLCanvasElement,
    playerPawn: PlayerPawn,
    playerController: PlayerController,
    inventoryUI: InventoryUI
  ): void {
    this.scene = scene;
    this.canvas = canvas;
    this.playerPawn = playerPawn;
    this.playerController = playerController;
    this.inventoryUI = inventoryUI;

    if (!this.isInitialized) {
      window.addEventListener('keydown', this.handleKeyDown);
      this.isInitialized = true;
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    const state = gameStateStore.get();
    if (state === 'READY') return;

    if (!this.scene || !this.playerPawn || !this.playerController || !this.inventoryUI) return;

    const isGameOver = state === 'GAME_OVER';

    // 2. 인스펙터 토글 (I)
    if (e.code === 'KeyI' && !e.repeat) {
      if (this.scene.debugLayer.isVisible()) {
        this.scene.debugLayer.hide();
        if (this.canvas) this.canvas.requestPointerLock();
      } else {
        this.scene.debugLayer.show();
        document.exitPointerLock();
      }
    }

    // 3. 인벤토리 토글 (Tab)
    if (e.code === 'Tab') {
      if (isGameOver) return;
      e.preventDefault();
      const isOpen = this.inventoryUI.toggle();
      this.playerController.setInputBlocked(isOpen);

      if (isOpen) {
        document.exitPointerLock();
      } else {
        if (this.canvas) this.canvas.requestPointerLock();
      }
    }

    // 4. 포즈 메뉴 토글 (Escape)
    if (e.code === 'Escape') {
      if (isGameOver) return;

      const ui = this.uiManager;
      if (ui) {
        if (ui.currentScreen === UIScreen.SETTINGS) {
          // If we are in game (which we are if GlobalInputManager is active), return to PAUSE
          ui.showScreen(UIScreen.PAUSE);
          return;
        }

        const isPaused = ui.currentScreen === UIScreen.PAUSE;
        if (isPaused) {
          ui.showScreen(UIScreen.NONE);
          this.playerController!.setInputBlocked(false);
        } else {
          ui.showScreen(UIScreen.PAUSE);
          this.playerController!.setInputBlocked(true);
        }
      }
    }
  };

  public dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
  }
}
