import { Scene, Mesh, Behavior, Nullable } from '@babylonjs/core';
import type { IPawn } from '../../../types/IPawn';
import { ITickable } from '../../interfaces/ITickable';
import { TickManager } from '../../managers/TickManager';

// Generic constraint typically requires any[], as unknown[] is too strict for constructors
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ComponentConstructor<T extends BaseComponent> = abstract new (...args: any[]) => T;

/**
 * 모든 컴포넌트의 가상 기본 클래스.
 * Babylon.js의 Behavior 패턴을 상속하여 엔진의 표준 수명 주기를 따릅니다.
 */
export abstract class BaseComponent implements Behavior<Mesh>, ITickable {
  public abstract name: string;
  public attachedNode: Nullable<Mesh> = null;
  public readonly priority: number = 25; // 컴포넌트는 컨트롤러/폰 이후에 업데이트
  protected owner: IPawn;
  protected scene: Scene;

  constructor(owner: IPawn, scene: Scene) {
    this.owner = owner;
    this.scene = scene;
  }

  public init(): void {
    // 필요한 초기화 logic
  }

  public attach(target: Mesh): void {
    this.attachedNode = target;
    // 중앙 TickManager에 등록
    TickManager.getInstance().register(this);
  }

  public detach(): void {
    // TickManager에서 등록 해제
    TickManager.getInstance().unregister(this);
    this.attachedNode = null;
  }

  /** ITickable 인터페이스 구현 */
  public tick(deltaTime: number): void {
    if (this.attachedNode) {
      this.update(deltaTime);
    }
  }

  /** 매 프레임 업데이트 로직 (Abstract) */
  public abstract update(deltaTime: number): void;

  /** 리소스 해제 */
  public dispose(): void {
    this.detach();
  }
}
