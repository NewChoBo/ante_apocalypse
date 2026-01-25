import { Scene } from '@babylonjs/core';
import { PickupManager } from './PickupManager';
import { PlayerPawn } from '../PlayerPawn';
import { PlayerController } from '../controllers/PlayerController';
import { InventoryUI } from '../../ui/inventory/InventoryUI';
import { gameStateStore } from '../store/GameStore';

export class GlobalInputManager {
  private static instance: GlobalInputManager;
  private scene: Scene | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private playerPawn: PlayerPawn | null = null;
  private playerController: PlayerController | null = null;
  private inventoryUI: InventoryUI | null = null;

  private constructor() {}

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

    const isPaused = state === 'PAUSED' || state === 'GAME_OVER';

    // 1. 디버그용 아이템 스폰 (H: Health, J: Ammo)
    // 임시로 Game.isRunning 같은 상태를 GlobalInputManager가 알아야 함.
    // 하지만 일단 기존 로직을 최대한 유지하면서 이동.

    if (e.code === 'KeyH') {
      if (!isPaused) {
        PickupManager.getInstance().spawnPickup(this.playerPawn.mesh.position, 'health_pack');
        console.log('[DEBUG] Spawned Health Pickup');
      }
    }
    if (e.code === 'KeyJ') {
      if (!isPaused) {
        PickupManager.getInstance().spawnPickup(this.playerPawn.mesh.position, 'ammo_box');
        console.log('[DEBUG] Spawned Ammo Pickup');
      }
    }

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
      e.preventDefault();
      const isOpen = this.inventoryUI.toggle();
      this.playerController.setInputBlocked(isOpen);

      if (isOpen) {
        document.exitPointerLock();
      } else {
        if (this.canvas) this.canvas.requestPointerLock();
      }
    }
  };

  public dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
  }
}
