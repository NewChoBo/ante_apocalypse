import { Scene } from '@babylonjs/core';
import { PickupManager } from '../entities/PickupManager';
import { PlayerPawn } from '../pawns/PlayerPawn';
import { PlayerController } from '../controllers/PlayerController';
import { InventoryUI } from '../../ui/inventory/InventoryUI';
import { gameStateStore } from '../store/GameStore';
import { InputManager } from './InputManager';
import { InputAction } from '../../types/InputTypes';

export class GlobalInputManager {
  private static instance: GlobalInputManager;
  private scene: Scene | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private playerPawn: PlayerPawn | null = null;
  private playerController: PlayerController | null = null;
  private inventoryUI: InventoryUI | null = null;
  private inputManager: InputManager;

  private constructor() {
    this.inputManager = InputManager.getInstance();
  }

  public static getInstance(): GlobalInputManager {
    if (!GlobalInputManager.instance) {
      GlobalInputManager.instance = new GlobalInputManager();
    }
    return GlobalInputManager.instance;
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

    window.addEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    const state = gameStateStore.get();
    if (state === 'READY') return;

    if (!this.scene || !this.playerPawn || !this.playerController || !this.inventoryUI) return;

    // Use current key code to find action from InputManager mappings
    const action = this.inputManager.mappings.keyboard[e.code];
    if (!action) return;

    const isPaused = state === 'PAUSED' || state === 'GAME_OVER';

    switch (action) {
      case InputAction.DEBUG_HEALTH:
        if (!isPaused) {
          PickupManager.getInstance().spawnPickup(this.playerPawn.mesh.position, 'health_pack');
          console.log('[DEBUG] Spawned Health Pickup');
        }
        break;
      case InputAction.DEBUG_AMMO:
        if (!isPaused) {
          PickupManager.getInstance().spawnPickup(this.playerPawn.mesh.position, 'ammo_box');
          console.log('[DEBUG] Spawned Ammo Pickup');
        }
        break;
      case InputAction.INSPECTOR:
        if (!e.repeat) {
          if (this.scene.debugLayer.isVisible()) {
            this.scene.debugLayer.hide();
            if (this.canvas) this.canvas.requestPointerLock();
          } else {
            this.scene.debugLayer.show();
            document.exitPointerLock();
          }
        }
        break;
      case InputAction.INVENTORY: {
        if (isPaused) return;
        e.preventDefault();
        const isOpen = this.inventoryUI.toggle();
        this.playerController.setInputBlocked(isOpen);

        if (isOpen) {
          document.exitPointerLock();
        } else {
          if (this.canvas) this.canvas.requestPointerLock();
        }
        break;
      }
    }
  };

  public dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
  }
}
