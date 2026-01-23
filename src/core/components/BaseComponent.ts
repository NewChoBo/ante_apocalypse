import { Scene } from '@babylonjs/core';
import type { BasePawn } from '../BasePawn';

/**
 * 모든 컴포넌트의 가상 기본 클래스.
 */
export abstract class BaseComponent {
  protected owner: BasePawn;
  protected scene: Scene;

  constructor(owner: BasePawn, scene: Scene) {
    this.owner = owner;
    this.scene = scene;
  }

  /** 매 프레임 업데이트 로직 */
  public abstract update(deltaTime: number): void;

  /** 리소스 해제 */
  public dispose(): void {}
}
