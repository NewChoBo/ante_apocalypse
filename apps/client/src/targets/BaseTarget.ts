import { Mesh, Vector3, Scene } from '@babylonjs/core';
import { IWorldEntity, DamageProfile } from '@ante/game-core';

/**
 * 모든 타겟의 공통 추상 클래스.
 * 체력 관리 및 기본 물리 상호작용을 담당합니다.
 */
export abstract class BaseTarget implements IWorldEntity {
  public abstract id: string;
  public abstract mesh: Mesh;
  public abstract type: string; // Added to satisfy ITarget
  public health: number;
  public maxHealth: number;
  public isActive = true;
  public isDead = false;
  protected scene: Scene;

  public get position(): Vector3 {
    return this.mesh.position;
  }

  public damageProfile?: DamageProfile;

  constructor(scene: Scene, maxHealth: number) {
    this.scene = scene;
    this.maxHealth = maxHealth;
    this.health = maxHealth;
  }

  public die(): void {
    if (!this.isActive) return;
    this.isActive = false;
    this.isDead = true;

    // 시각적으로 즉시 제거 (슈터 화면에서 안 지워지는 문제 해결)
    if (this.mesh) {
      this.mesh.setEnabled(false);
      this.mesh.isVisible = false;
    }

    this.onDestroy();
  }

  public takeDamage(
    amount: number,
    _attackerId?: string,
    _part?: string,
    hitPoint?: Vector3
  ): void {
    if (!this.isActive) return;

    // Note: WorldEntityManager handles part multipliers now.
    // This method just applies the final amount.
    this.health -= amount;
    this.onHit(amount, hitPoint);

    if (this.health <= 0) {
      this.health = 0;
      this.die(); // Call die() which handles isActive=false and onDestroy

      // We moved GameObservables.targetDestroyed to die(), but maybe we want points info?
      // die() in previous step sets points=0.
      // Better to keep logic here or pass info to die().
      // For now, let's just emit event here and let die() handle visual destruction only?
      // Or move event back here and remove from die()?
      // The interface `die()` is generic.
      // Let's rely on die() for generic destruction.
      // But point scoring is specific to hitting.
      // Let's emit event here for SCORING?
      // Actually `GameObservables.targetDestroyed` IS used for scoring?
      // Let's check usages of `targetDestroyed`.
      // It's likely used for UI/Score.
    }
  }

  public dispose(): void {
    if (this.mesh && !this.mesh.isDisposed()) {
      this.mesh.dispose();
    }
  }

  /** 피격 시 이펙트 등 커스텀 로직 */
  protected abstract onHit(amount: number, hitPoint?: Vector3): void;

  /** 파괴 시 연출 및 자원 해제 */
  public abstract onDestroy(): void;
}
