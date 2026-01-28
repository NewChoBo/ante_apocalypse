import { Scene, AbstractMesh, UniversalCamera, Vector3, Mesh, Observable } from '@babylonjs/core';
import { IWeapon } from '../types/IWeapon';
import { NetworkManager } from '../core/network/NetworkManager';
import { ReqHitPayload } from '../shared/protocol/NetworkProtocol';

/**
 * 모든 무기의 최상위 추상 클래스.
 */
export abstract class BaseWeapon implements IWeapon {
  public abstract name: string;
  public abstract damage: number;
  public abstract range: number;

  protected scene: Scene;
  protected camera: UniversalCamera;
  protected onScoreCallback: ((points: number) => void) | null = null;
  protected weaponMesh: AbstractMesh | null = null;

  public isActive = false;
  public isAiming = false;

  // Prediction Observable
  public onHitPredicted = new Observable<{ position: Vector3; normal: Vector3 }>();
  public onFirePredicted = new Observable<IWeapon>();

  // 절차적 애니메이션 상태
  protected visualOffset = new Vector3(0, 0, 0);
  protected visualRotation = new Vector3(0, 0, 0);
  protected animState: 'idle' | 'lowering' | 'raising' = 'idle';
  protected animProgress = 1; // 1: 완전히 올라옴, 0: 완전히 내려감
  protected animSpeed = 5.0;

  protected idlePosition = new Vector3(0, 0, 0);
  protected idleRotation = new Vector3(0, 0, 0);

  /** 현재 무기의 기본 위치와 회전을 저장 (애니메이션 기준점) */
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

  constructor(scene: Scene, camera: UniversalCamera, onScore?: (points: number) => void) {
    this.scene = scene;
    this.camera = camera;
    this.onScoreCallback = onScore || null;
  }

  /** 무기 사용 (사격 혹은 휘두르기) */
  public abstract fire(): boolean;

  /** 사용 시작 (연사 혹은 차지) */
  public abstract startFire(): void;

  /** 사용 중지 */
  public abstract stopFire(): void;

  /** 매 프레임 업데이트 */
  public abstract update(deltaTime: number): void;

  /** 탄약 추가 */
  public abstract addAmmo(amount: number): void;

  /** 무기 스탯 정보 */
  public abstract getStats(): Record<string, unknown>;

  public show(): void {
    this.isActive = true;
    if (this.weaponMesh) {
      this.weaponMesh.setEnabled(true);
    }
  }

  public hide(): void {
    this.isActive = false;
    this.stopFire();
    if (this.weaponMesh) {
      this.weaponMesh.setEnabled(false);
    }
  }

  public setAiming(isAiming: boolean): void {
    this.isAiming = isAiming;
  }

  /** 무기 내리기 애니메이션 시작 */
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

  /** 무기 올리기 애니메이션 시작 */
  public raise(): void {
    this.animState = 'raising';
    this.animProgress = 0;
    this.show();
  }

  /** 절차적 애니메이션 업데이트 (매 프레임 호출 필요) */
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

  /** 공통 히트 처리 로직 (적, 타겟 모두 포함) */
  protected processHit(pickedMesh: Mesh, pickedPoint: Vector3, damageAmount: number): boolean {
    const metadata = pickedMesh.metadata;
    if (!metadata) return false;

    // Pawn(Enemy/Player) or Target ID detection
    const entityId = metadata.pawn?.id || metadata.targetId;
    if (!entityId) return false;

    const part = metadata.bodyPart || metadata.part || 'body';

    // 1. Prediction Event (VFX, Sound)
    this.onHitPredicted.notifyObservers({
      position: pickedPoint,
      normal: Vector3.Up(), // Fallback normal as processHit doesn't have it
    });

    // 2. Score processing (Optimistic / Local)
    if (this.onScoreCallback) {
      const score = part === 'head' ? 100 : 50;
      this.onScoreCallback(score);
    }

    // 3. Authority Request
    const req = new ReqHitPayload(
      entityId,
      damageAmount,
      { x: pickedPoint.x, y: pickedPoint.y, z: pickedPoint.z },
      undefined, // Use default timestamp
      { x: 0, y: 1, z: 0 } // Default normal
    );
    NetworkManager.getInstance().requestHit(req);

    return true;
  }

  public dispose(): void {
    if (this.weaponMesh) {
      this.weaponMesh.dispose();
    }
    this.onHitPredicted.clear();
  }
}
