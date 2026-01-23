import { Mesh, Vector3, Scene } from '@babylonjs/core';
import { ITarget } from '../types/ITarget.ts';
import { GameObservables } from '../core/events/GameObservables.ts';

/**
 * 모든 타겟의 공통 추상 클래스.
 * 체력 관리 및 기본 물리 상호작용을 담당합니다.
 */
export abstract class BaseTarget implements ITarget {
  public abstract id: string;
  public abstract mesh: Mesh;
  public health: number;
  public maxHealth: number;
  public isActive = true;
  protected scene: Scene;

  constructor(scene: Scene, maxHealth: number) {
    this.scene = scene;
    this.maxHealth = maxHealth;
    this.health = maxHealth;
  }

  public takeDamage(amount: number, part?: string, hitPoint?: Vector3): void {
    if (!this.isActive) return;

    let finalDamage = amount;
    if (part === 'head') {
      finalDamage *= 3;
    }

    this.health -= finalDamage;
    this.onHit(finalDamage, hitPoint);

    if (this.health <= 0) {
      this.health = 0;
      this.isActive = false;
      this.onDestroy();

      // 타겟 파괴 이벤트 발행 (Babylon Observable 사용)
      GameObservables.targetDestroyed.notifyObservers({
        targetId: this.id,
        points: finalDamage, // points를 finalDamage로 계산
        position: this.mesh.position.clone(),
      });
    }
  }

  /** 피격 시 이펙트 등 커스텀 로직 */
  protected abstract onHit(amount: number, hitPoint?: Vector3): void;

  /** 파괴 시 연출 및 자원 해제 */
  public abstract onDestroy(): void;
}
