import { Mesh, Vector3, Scene, Nullable } from '@babylonjs/core';
import { IPawn } from '../../types/IPawn';
import { BaseComponent, ComponentConstructor } from '../components/base/BaseComponent';
import { IWorldEntity, DamageProfile } from '../../types/IWorldEntity';
import { TickManager } from '../managers/TickManager';

/**
 * 모든 Pawn의 공통 기능을 담은 추상 클래스.
 */
export abstract class BasePawn implements IPawn, IWorldEntity {
  public abstract mesh: Mesh;
  public abstract type: string;
  public controllerId: string | null = null;
  public id: string = '';
  public health: number = 100;
  public maxHealth: number = 100;
  public isActive: boolean = true;
  public isDead: boolean = false;
  public readonly priority: number = 20;

  public damageProfile?: DamageProfile;

  protected scene: Scene;
  protected components: BaseComponent[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
    // 중앙 TickManager에 등록
    TickManager.getInstance().register(this);
  }

  /** ITickable 인터페이스 구현 (하위 클래스에서 상속받아 구현) */
  public abstract tick(deltaTime: number): void;

  /** 데미지 처리 */
  public abstract takeDamage(
    amount: number,
    attackerId?: string,
    part?: string,
    hitPoint?: Vector3
  ): void;

  /** 사망 처리 */
  public abstract die(): void;

  /** 체력 강제 동기화 */
  public abstract updateHealth(amount: number): void;

  /** 입력 시스템 설정 (하위 클래스에서 구현) */
  public abstract setupInput(enabled: boolean): void;

  /** 컴포넌트(Behavior) 추가 */
  public addComponent(component: BaseComponent): void {
    this.components.push(component);
    if (this.mesh) {
      this.mesh.addBehavior(component);
    }
  }

  /** 컴포넌트(Behavior) 제거 및 메모리 해제 */
  public removeComponent(component: BaseComponent): void {
    const index = this.components.indexOf(component);
    if (index !== -1) {
      this.components.splice(index, 1);
    }

    if (this.mesh) {
      this.mesh.removeBehavior(component);
    }

    // 명시적 리소스 해제 호출
    component.dispose();
  }

  public getComponent<T extends BaseComponent>(type: ComponentConstructor<T>): T | undefined {
    return this.components.find((b) => b instanceof type) as T;
  }

  /** 모든 컴포넌트 업데이트 (Behavior가 각자 처리하므로 메서드는 공백으로 유지 가능하거나 제거) */
  protected updateComponents(_deltaTime: number): void {
    // Babylon.js Behavior가 attach 시점에 등록한 observer에 의해 자동 업데이트됩니다.
  }

  public get position(): Vector3 {
    return this.mesh.position;
  }

  public set position(value: Vector3) {
    this.mesh.position.copyFrom(value);
  }

  /** 하위 클래스에서 구체적인 초기화 로직 구현 */
  public abstract initialize(scene: Scene): void;

  /** 기본 리소스 해제 */
  public dispose(): void {
    // TickManager에서 등록 해제
    TickManager.getInstance().unregister(this);

    // 모든 컴포넌트 해제
    this.components.forEach((comp) => comp.dispose());
    this.components = [];

    // Babylon.js mesh dispose 시 behaviors도 함께 해제되지만 명시적 호출
    if (this.mesh) {
      this.mesh.dispose();
      (this as unknown as { mesh: Nullable<Mesh> }).mesh = null;
    }
  }
}
