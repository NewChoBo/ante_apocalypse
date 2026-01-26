import { Mesh, Vector3, Scene, Observer, Nullable } from '@babylonjs/core';
import { IPawn } from '../types/IPawn';
import { BaseComponent } from './components/BaseComponent';
import { IWorldEntity, DamageProfile } from '../types/IWorldEntity';

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
  private _tickObserver: Nullable<Observer<Scene>> = null;

  constructor(scene: Scene) {
    this.scene = scene;
    // 씬의 렌더 루프에 업데이트 등록 (Babylon.js 표준 방식)
    this._tickObserver = this.scene.onBeforeRenderObservable.add(() => {
      const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;
      if (this.isActive) {
        this.tick(deltaTime);
      }
    });
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

  /** 컴포넌트(Behavior) 추가 */
  public addComponent(component: BaseComponent): void {
    if (this.mesh) {
      this.mesh.addBehavior(component);
    }
  }

  /** 특정 타입의 컴포넌트 찾기 (Babylon.js behaviors 목록에서 검색) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getComponent<T extends BaseComponent>(type: new (...args: any[]) => T): T | undefined {
    if (!this.mesh) return undefined;
    return this.mesh.behaviors.find((b) => b instanceof type) as T;
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
    if (this._tickObserver) {
      this.scene.onBeforeRenderObservable.remove(this._tickObserver);
      this._tickObserver = null;
    }

    // Babylon.js mesh dispose 시 behaviors도 함께 해제되지만 명시적 호출
    if (this.mesh) {
      this.mesh.dispose();
      (this as unknown as { mesh: Nullable<Mesh> }).mesh = null;
    }
  }
}
