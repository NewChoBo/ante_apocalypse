import { Mesh, Scene } from '@babylonjs/core';
import { IPawn } from '../types/IPawn';
import { IDestructible } from './interfaces/IDestructible';
import { BasePawn as SharedBasePawn, TickManager } from '@ante/game-core';

/**
 * 모든 Pawn의 공통 기능을 담은 추상 클래스 (클라이언트 전용 확장).
 */
export abstract class BasePawn extends SharedBasePawn implements IPawn, IDestructible {
  public abstract override mesh: Mesh;
  public controllerId: string | null = null;

  constructor(scene: Scene, tickManager: TickManager) {
    super(scene, tickManager);
  }

  /** 하위 클래스에서 구체적인 초기화 로직 구현 */
  public abstract initialize(scene: Scene): void;
}
