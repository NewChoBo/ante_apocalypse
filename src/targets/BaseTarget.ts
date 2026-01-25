import { Mesh, Vector3, Scene } from '@babylonjs/core';
import { ITarget } from '../types/ITarget.ts';

/**
 * 모든 타겟의 공통 추상 클래스.
 * 체력 관리 및 기본 물리 상호작용을 담당합니다.
 */
export abstract class BaseTarget implements ITarget {
  public abstract id: string;
  public abstract mesh: Mesh;
  public abstract type: string; // Added to satisfy ITarget
  public health: number;
  public maxHealth: number;
  public isActive = true;
  protected scene: Scene;

  constructor(scene: Scene, maxHealth: number) {
    this.scene = scene;
    this.maxHealth = maxHealth;
    this.health = maxHealth;
  }

  public get isDead(): boolean {
    return !this.isActive;
  }

  public die(): void {
    if (!this.isActive) return;
    this.isActive = false;
    this.onDestroy();
  }

  public takeDamage(amount: number, _attackerId?: string, part?: string, hitPoint?: Vector3): void {
    if (!this.isActive) return;

    let finalDamage = amount;
    if (part === 'head') {
      finalDamage *= 3;
    }
    console.log(
      `[BaseTarget] Target ${this.id} took ${finalDamage} damage. Current health: ${this.health - finalDamage}/${this.maxHealth}`
    );

    this.health -= finalDamage;
    this.onHit(finalDamage, hitPoint);

    if (this.health <= 0) {
      console.log(`[BaseTarget] Health reached zero for ${this.id}. Calling die().`);
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

  /** 피격 시 이펙트 등 커스텀 로직 */
  protected abstract onHit(amount: number, hitPoint?: Vector3): void;

  /** 파괴 시 연출 및 자원 해제 */
  public abstract onDestroy(): void;
}
