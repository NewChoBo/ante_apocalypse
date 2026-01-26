import { Scene, Mesh, Behavior, Observer, Nullable } from '@babylonjs/core';
import type { IPawn } from '../../../types/IPawn';

/**
 * 모든 컴포넌트의 가상 기본 클래스.
 * Babylon.js의 Behavior 패턴을 상속하여 엔진의 표준 수명 주기를 따릅니다.
 */
export abstract class BaseComponent implements Behavior<Mesh> {
  public abstract name: string;
  public attachedNode: Nullable<Mesh> = null;
  protected owner: IPawn;
  protected scene: Scene;
  private renderObserver: Nullable<Observer<Scene>> = null;

  constructor(owner: IPawn, scene: Scene) {
    this.owner = owner;
    this.scene = scene;
  }

  public init(): void {
    // 필요한 초기화 logic
  }

  public attach(target: Mesh): void {
    this.attachedNode = target;
    // Babylon.js의 렌더 루프에 업데이트 등록 (엔진 표준 방식)
    this.renderObserver = this.scene.onBeforeRenderObservable.add(() => {
      const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;
      this.update(deltaTime);
    });
  }

  public detach(): void {
    if (this.renderObserver) {
      this.scene.onBeforeRenderObservable.remove(this.renderObserver);
      this.renderObserver = null;
    }
    this.attachedNode = null;
  }

  /** 매 프레임 업데이트 로직 (Abstract) */
  public abstract update(deltaTime: number): void;

  /** 리소스 해제 */
  public dispose(): void {
    this.detach();
  }
}
