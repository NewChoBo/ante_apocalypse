import { Mesh, Vector3, Scene } from '@babylonjs/core';
import { IPawn } from '../types/IPawn';
import { BaseComponent } from './components/BaseComponent';
import { ITickable } from './interfaces/ITickable';
import { TickManager } from './TickManager';

/**
 * 모든 Pawn의 공통 기능을 담은 추상 클래스.
 */
export abstract class BasePawn implements IPawn, ITickable {
  public abstract mesh: Mesh;
  public controllerId: string | null = null;
  public readonly priority = 20;

  protected scene: Scene;
  protected components: BaseComponent[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
    // TickManager에 자동 등록
    TickManager.getInstance().register(this);
  }

  /** ITickable 인터페이스 구현 (하위 클래스에서 상속받아 구현) */
  public abstract tick(deltaTime: number): void;

  /** 컴포넌트 추가 */
  public addComponent(component: BaseComponent): void {
    this.components.push(component);
  }

  /** 특정 타입의 컴포넌트 찾기 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getComponent<T extends BaseComponent>(type: new (...args: any[]) => T): T | undefined {
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

  /** 기본 리소스 해제 */
  public dispose(): void {
    // TickManager에서 등록 해제
    TickManager.getInstance().unregister(this);

    for (const component of this.components) {
      component.dispose();
    }
    if (this.mesh) {
      this.mesh.dispose();
    }
  }
}
