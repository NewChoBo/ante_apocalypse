import { Scene, UniversalCamera, Vector3, AbstractMesh, Mesh } from '@babylonjs/core';
import { WorldEntityManager } from '../core/systems/WorldEntityManager';
import { GameObservables } from '../core/events/GameObservables';

/**
 * Visual controller class for weapon functionality.
 * Implements composition pattern as alternative to Mixin.
 */
export class WeaponVisualController {
  // Visual State
  public scene: Scene;
  public camera: UniversalCamera;
  public weaponMesh: AbstractMesh | null = null;

  public isActive = false;
  public isAiming = false;

  // Animation State
  protected visualOffset = new Vector3(0, 0, 0);
  protected visualRotation = new Vector3(0, 0, 0);
  protected animState: 'idle' | 'lowering' | 'raising' = 'idle';
  protected animProgress = 1;
  protected animSpeed = 5.0;
  protected idlePosition = new Vector3(0, 0, 0);
  protected idleRotation = new Vector3(0, 0, 0);

  // Callback for stopping fire when hiding weapon
  private onStopFireCallback: (() => void) | null = null;

  constructor(scene: Scene, camera: UniversalCamera, onStopFire?: () => void) {
    this.scene = scene;
    this.camera = camera;
    this.onStopFireCallback = onStopFire || null;
  }

  /**
   * Set weapon mesh
   */
  public setWeaponMesh(mesh: AbstractMesh | null): void {
    this.weaponMesh = mesh;
    if (mesh) {
      this.setIdleState();
    }
  }

  /**
   * Store current idle state
   */
  public setIdleState(): void {
    if (this.weaponMesh) {
      this.idlePosition.copyFrom(this.weaponMesh.position);
      this.idleRotation.copyFrom(this.weaponMesh.rotation);
    }
  }

  /**
   * Returns movement speed multiplier (default)
   * Can be overridden in subclasses
   */
  public getMovementSpeedMultiplier(): number {
    return 1.0;
  }

  /**
   * Returns FOV adjustment (default)
   * Can be overridden in subclasses
   */
  public getDesiredFOV(defaultFOV: number): number {
    return defaultFOV;
  }

  /**
   * Show weapon
   */
  public show(): void {
    this.isActive = true;
    if (this.weaponMesh) {
      this.weaponMesh.setEnabled(true);
    }
  }

  /**
   * Hide weapon
   */
  public hide(): void {
    this.isActive = false;
    // stopFire 콜백 호출
    if (this.onStopFireCallback) {
      this.onStopFireCallback();
    }
    if (this.weaponMesh) {
      this.weaponMesh.setEnabled(false);
    }
  }

  /**
   * Set aiming state
   */
  public setAiming(isAiming: boolean): void {
    this.isAiming = isAiming;
  }

  /**
   * Lower weapon animation
   */
  public async lower(): Promise<void> {
    if (this.animState === 'lowering') return;
    this.animState = 'lowering';
    return new Promise((resolve) => {
      const check = (): void => {
        if (this.animProgress <= 0) {
          this.animState = 'idle';
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
  }

  /**
   * Raise weapon animation
   */
  public raise(): void {
    this.animState = 'raising';
    this.animProgress = 0;
    this.show();
  }

  /**
   * Update animations
   */
  public updateAnimations(deltaTime: number): void {
    if (this.animState === 'lowering') {
      this.animProgress = Math.max(0, this.animProgress - deltaTime * this.animSpeed);
    } else if (this.animState === 'raising') {
      this.animProgress = Math.min(1, this.animProgress + deltaTime * this.animSpeed);
      if (this.animProgress >= 1) {
        this.animState = 'idle';
      }
    }

    if (this.weaponMesh) {
      const yOffset = (this.animProgress - 1) * 0.5;
      this.weaponMesh.position.y = this.idlePosition.y + yOffset;

      const xRot = (1 - this.animProgress) * 0.5;
      this.weaponMesh.rotation.x = this.idleRotation.x + xRot;
    }
  }

  /**
   * Process hit
   */
  public processHit(pickedMesh: Mesh, pickedPoint: Vector3, damageAmount: number): boolean {
    const metadata = pickedMesh.metadata;
    if (!metadata) return false;

    const entityId = metadata.pawn?.id || metadata.targetId;
    if (!entityId) return false;

    const part = metadata.bodyPart || metadata.part || 'body';

    WorldEntityManager.getInstance().processHit(entityId, damageAmount, part, pickedPoint, false);

    GameObservables.targetHit.notifyObservers({
      targetId: entityId,
      part: part,
      damage: damageAmount,
      position: pickedPoint,
    });

    return true;
  }

  /**
   * 리소스 해제
   */
  public dispose(): void {
    if (this.weaponMesh) {
      this.weaponMesh.dispose();
      this.weaponMesh = null;
    }
  }
}
