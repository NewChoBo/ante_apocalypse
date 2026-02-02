import { Scene } from '@babylonjs/core';
import { IPawnComponent, IPawn } from '@ante/common';

/**
 * 모든 컴포넌트의 가상 기본 클래스.
 *
 * 이제 IPawnComponent 인터페이스를 구현하여 composition 기반 Pawn과 호환됩니다.
 */
export abstract class BaseComponent implements IPawnComponent<IPawn> {
  public readonly componentId: string;
  public abstract readonly componentType: string;
  public isActive = true;

  constructor(
    protected owner: IPawn,
    protected scene: Scene
  ) {
    this.componentId = `component_${Math.random().toString(36).substr(2, 9)}`;
  }

  /** IPawnComponent: Called when attached to a pawn */
  public onAttach(_pawn: IPawn): void {
    // Override in subclass if needed
  }

  /** 매 프레임 업데이트 로직 */
  public abstract update(deltaTime: number): void;

  /** IPawnComponent: Called when detached from a pawn */
  public onDetach(): void {
    // Override in subclass if needed
  }

  /** 리소스 해제 */
  public dispose(): void {}
}
