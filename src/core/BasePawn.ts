import { Mesh, Vector3, Scene } from '@babylonjs/core';
import { IPawn } from '../types/IPawn.ts';

/**
 * 모든 Pawn의 공통 기능을 담은 추상 클래스.
 */
export abstract class BasePawn implements IPawn {
  public abstract mesh: Mesh;
  public controllerId: string | null = null;
  protected scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
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
    if (this.mesh) {
      this.mesh.dispose();
    }
  }
}
