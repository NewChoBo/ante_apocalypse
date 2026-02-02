/**
 * BasePawn - Client-side extension of the composition-based Pawn
 *
 * This class extends the new Pawn from @ante/game-core and adds
 * client-specific functionality like controller ID tracking.
 *
 * Migration: This replaces the old inheritance-based BasePawn that extended
 * SharedBasePawn. Now we use the composition-based Pawn from game-core.
 */

import { Mesh, Scene } from '@babylonjs/core';
import { Pawn } from '@ante/game-core';
import { IPawn as IPawnInterface } from '../types/IPawn';
import { IDestructible } from './interfaces/IDestructible';

/**
 * 모든 Pawn의 공통 기능을 담은 추상 클래스 (클리이언트 전용 확장).
 *
 * 이제 composition 기반의 Pawn을 확장하여 사용합니다.
 */
export abstract class BasePawn extends Pawn implements IPawnInterface, IDestructible {
  public abstract override mesh: Mesh;
  public controllerId: string | null = null;

  constructor(scene: Scene, type: string, id?: string) {
    super(scene, { type: type as any, id });
  }

  /** 하위 클래스에서 구체적인 초기화 로직 구현 */
  public abstract initialize(scene: Scene): void;
}
