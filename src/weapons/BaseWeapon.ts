import { Scene, AbstractMesh, UniversalCamera, Vector3, Mesh } from '@babylonjs/core';
import { IWeapon } from '../types/IWeapon.ts';
import { TargetRegistry } from '../core/systems/TargetRegistry';
import { GameObservables } from '../core/events/GameObservables';
import { NetworkManager } from '../core/systems/NetworkManager';
import { RemotePlayerPawn } from '../core/RemotePlayerPawn';
import { EventCode } from '../core/network/NetworkProtocol';

/**
 * 모든 무기의 최상위 추상 클래스.
 * 총기, 근접 무기 등에 공통적으로 필요한 기본 필드와 메서드만 포함합니다.
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
    // 애니메이션이 끝날 때까지 대기하는 프로미스를 반환할 수도 있지만,
    // 여기서는 간단히 상태만 변경하고 update에서 처리합니다.
    return new Promise((resolve) => {
      const check = () => {
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
      // Y축 오프셋 적용 (무기가 아래로 내려가는 효과)
      // animProgress가 1이면 0, 0이면 -0.5만큼 내려감
      const yOffset = (this.animProgress - 1) * 0.5;
      this.weaponMesh.position.y = this.idlePosition.y + yOffset;

      // X축 회전 적용 (내려갈 때 살짝 눕는 효과)
      const xRot = (1 - this.animProgress) * 0.5;
      this.weaponMesh.rotation.x = this.idleRotation.x + xRot;
    }
  }

  /** 공통 히트 처리 로직 (적, 타겟 모두 포함) */
  protected processHit(pickedMesh: Mesh, pickedPoint: Vector3, damageAmount: number): boolean {
    // 1. Pawn (Enemy or Remote Player) 피격 처리
    const metadata = pickedMesh.metadata;
    if (metadata && metadata.pawn) {
      const pawn = metadata.pawn;
      let finalDamage = damageAmount;
      let part = 'body';

      if (metadata.bodyPart === 'head') {
        finalDamage *= 2; // Headshot Multiplier
        part = 'head';
      }

      if (typeof pawn.takeDamage === 'function') {
        pawn.takeDamage(finalDamage);
      }

      GameObservables.targetHit.notifyObservers({
        targetId: pawn.id || 'unknown',
        part: part,
        damage: finalDamage,
        position: pickedPoint,
      });

      // 점수 처리
      if (this.onScoreCallback) {
        this.onScoreCallback(part === 'head' ? 100 : 50);
      }

      // 네트워크 동기화
      const type = metadata.type;
      if (type === 'remote_player' || pawn instanceof RemotePlayerPawn) {
        NetworkManager.getInstance().hit({
          targetId: pawn.id,
          damage: finalDamage,
        });
      } else if (type === 'enemy') {
        const enemyId = Array.from(pickedMesh.name.matchAll(/enemy_(\d+)/g))[0]?.[0] || pawn.id;
        NetworkManager.getInstance().sendEvent(
          EventCode.ENEMY_HIT,
          { id: enemyId || pawn.id, damage: finalDamage },
          true
        );
      }

      return true;
    }

    // 2. 타겟(Target) 피격 처리
    if (pickedMesh.metadata && pickedMesh.metadata.targetId) {
      const targetId = pickedMesh.metadata.targetId;
      const part = pickedMesh.metadata.part || 'body';

      const isHeadshot = part === 'head';
      const destroyed = TargetRegistry.getInstance().hitTarget(targetId, part, damageAmount);

      if (this.onScoreCallback) {
        const score = destroyed ? (isHeadshot ? 200 : 100) : isHeadshot ? 30 : 10;
        this.onScoreCallback(score);
      }

      GameObservables.targetHit.notifyObservers({
        targetId,
        part,
        damage: damageAmount,
        position: pickedPoint,
      });

      return true;
    }

    return false;
  }

  public dispose(): void {
    if (this.weaponMesh) {
      this.weaponMesh.dispose();
    }
  }
}
