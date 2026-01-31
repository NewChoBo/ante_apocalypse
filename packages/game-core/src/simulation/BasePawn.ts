import { Mesh, AbstractMesh, Vector3, Scene } from '@babylonjs/core';
import { DamageProfile } from '../types/IWorldEntity.js';
import { ITickable } from '../types/ITickable.js';
import { IPawnCore } from '../types/IPawnCore.js';
import { TickManager } from '../systems/TickManager.js';
import { BaseComponent } from './BaseComponent.js';

/**
 * 모든 Pawn의 공통 기능을 담은 추상 클래스.
 */
export abstract class BasePawn implements IPawnCore, ITickable {
  public abstract mesh: Mesh | AbstractMesh;
  public abstract type: string;
  public id: string = '';
  public health: number = 100;
  public maxHealth: number = 100;
  public isActive: boolean = true;
  public isDead: boolean = false;
  public readonly priority = 20;

  public damageProfile?: DamageProfile;

  protected components: BaseComponent[] = [];

  constructor(protected scene: Scene) {
    // TickManager에 자동 등록
    TickManager.getInstance().register(this);
  }

  /** ITickable 인터페이스 구현 */
  public abstract tick(deltaTime: number): void;

  /**
   * Common damage handling logic.
   * Subclasses should override `onTakeDamage` or `onDeath` for specific behavior.
   */
  public takeDamage(amount: number, attackerId?: string, part?: string, hitPoint?: Vector3): void {
    if (this.isDead) return;

    this.health = Math.max(0, this.health - amount);

    this.onTakeDamage(amount, attackerId, part, hitPoint);

    if (this.health <= 0) {
      this.die();
    }
  }

  protected onTakeDamage(
    _amount: number,
    _attackerId?: string,
    _part?: string,
    _hitPoint?: Vector3
  ): void {
    // Override in subclass
  }

  public die(): void {
    if (this.isDead) return;
    this.isDead = true;
    this.health = 0; // Ensure 0
    this.onDeath();
  }

  protected onDeath(): void {
    // Override in subclass
  }

  /** 컴포넌트 추가 */
  public addComponent(component: BaseComponent): void {
    this.components.push(component);
  }

  /** 특정 타입의 컴포넌트 찾기 */
  /** 특정 타입의 컴포넌트 찾기 */
  public getComponent<T extends BaseComponent>(type: new (...args: any[]) => T): T | undefined {
    return this.components.find((c) => c instanceof type) as T | undefined;
  }

  /** 모든 컴포넌트 업데이트 */
  protected updateComponents(deltaTime: number): void {
    for (const component of this.components) {
      component.update(deltaTime);
    }
  }

  public get position(): Vector3 {
    return this.mesh.position;
  }

  public set position(value: Vector3) {
    this.mesh.position.copyFrom(value);
  }

  /** 리소스 해제 */
  public dispose(): void {
    TickManager.getInstance().unregister(this);

    for (const component of this.components) {
      component.dispose();
    }
    if (this.mesh) {
      this.mesh.dispose();
    }
  }
}
