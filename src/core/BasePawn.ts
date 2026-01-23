import { Mesh, Vector3, Scene } from '@babylonjs/core';
import { IPawn } from '../types/IPawn.ts';
import { BaseComponent } from './components/BaseComponent';

/**
 * 모든 Pawn의 공통 기능을 담은 추상 클래스.
 */
export abstract class BasePawn implements IPawn {
  public abstract mesh: Mesh;
  public controllerId: string | null = null;
  protected scene: Scene;
  protected components: BaseComponent[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /** 컴포넌트 추가 */
  public addComponent(component: BaseComponent): void {
    this.components.push(component);
  }

  /** 특정 타입의 컴포넌트 찾기 */
  public getComponent<T extends BaseComponent>(type: new (...args: unknown[]) => T): T | undefined {
    return this.components.find((c) => c instanceof type) as T;
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

  /** 하위 클래스에서 구체적인 초기화 로직 구현 */
  public abstract initialize(scene: Scene): void;

  /** 하위 클래스에서 매 프레임 업데이트 로직 구현 */
  public abstract update(deltaTime: number): void;

  /** 기본 리소스 해제 */
  public dispose(): void {
    for (const component of this.components) {
      component.dispose();
    }
    if (this.mesh) {
      this.mesh.dispose();
    }
  }
}
