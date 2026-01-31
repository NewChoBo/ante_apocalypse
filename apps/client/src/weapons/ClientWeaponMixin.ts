import { Scene, UniversalCamera, Vector3, AbstractMesh, Mesh } from '@babylonjs/core';
import { WorldEntityManager } from '../core/systems/WorldEntityManager';
import { GameObservables } from '../core/events/GameObservables';

type Constructor<T = {}> = new (...args: any[]) => T;

export function ClientWeaponMixin<TBase extends Constructor>(Base: TBase) {
  // Remove strict implements IWeapon on the mixin class itself to avoid "missing abstract methods" error
  // The consuming class (Firearm/BaseWeapon) will implement IWeapon.
  return class extends Base {
    // Declarations for TS (interfaces) compatibility with IWeapon
    public name: string = '';
    public damage: number = 0;
    public range: number = 0;

    // Visual State
    public scene!: Scene;
    public camera!: UniversalCamera;
    public onScoreCallback: ((points: number) => void) | null = null;
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

    public initVisuals(scene: Scene, camera: UniversalCamera, onScore?: (points: number) => void) {
      this.scene = scene;
      this.camera = camera;
      this.onScoreCallback = onScore || null;
    }

    protected setIdleState(): void {
      if (this.weaponMesh) {
        this.idlePosition.copyFrom(this.weaponMesh.position);
        this.idleRotation.copyFrom(this.weaponMesh.rotation);
      }
    }

    public getMovementSpeedMultiplier(): number {
      return 1.0;
    }

    public getDesiredFOV(defaultFOV: number): number {
      return defaultFOV;
    }

    public show(): void {
      this.isActive = true;
      if (this.weaponMesh) {
        this.weaponMesh.setEnabled(true);
      }
    }

    public hide(): void {
      this.isActive = false;
      // stopFire() needs to be handled by the base class or abstract
      if ((this as any).stopFire) (this as any).stopFire();
      if (this.weaponMesh) {
        this.weaponMesh.setEnabled(false);
      }
    }

    public setAiming(isAiming: boolean): void {
      this.isAiming = isAiming;
    }

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

    public raise(): void {
      this.animState = 'raising';
      this.animProgress = 0;
      this.show();
    }

    protected updateAnimations(deltaTime: number): void {
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

    protected processHit(pickedMesh: Mesh, pickedPoint: Vector3, damageAmount: number): boolean {
      const metadata = pickedMesh.metadata;
      if (!metadata) return false;

      const entityId = metadata.pawn?.id || metadata.targetId;
      if (!entityId) return false;

      const part = metadata.bodyPart || metadata.part || 'body';

      WorldEntityManager.getInstance().processHit(entityId, damageAmount, part, pickedPoint, false);

      if (this.onScoreCallback) {
        const score = part === 'head' ? 100 : 50;
        this.onScoreCallback(score);
      }

      GameObservables.targetHit.notifyObservers({
        targetId: entityId,
        part: part,
        damage: damageAmount,
        position: pickedPoint,
      });

      return true;
    }

    public updateStats(stats: Partial<Record<string, unknown>>): void {
      // Base updateStats?
      if (stats.damage !== undefined) this.damage = stats.damage as number;
      if (stats.range !== undefined) this.range = stats.range as number;
    }

    public dispose(): void {
      if (this.weaponMesh) {
        this.weaponMesh.dispose();
      }
    }

    // Stubs for abstract methods expected by IWeapon but not implemented in Mixin
    // fire(), startFire(), stopFire(), update(), addAmmo(), getStats()
    // These must be provided by the class mixing this in.
  };
}
