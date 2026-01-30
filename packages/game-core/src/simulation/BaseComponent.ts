import { Scene } from '@babylonjs/core';
import { IPawnCore } from '../types/IPawnCore.js';

/**
 * 모든 컴포넌트의 가상 기본 클래스.
 */
export abstract class BaseComponent {
  constructor(
    protected owner: IPawnCore,
    protected scene: Scene
  ) {}

  /** 매 프레임 업데이트 로직 */
  public abstract update(deltaTime: number): void;

  /** 리소스 해제 */
  public dispose(): void {}
}
