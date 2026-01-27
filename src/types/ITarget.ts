import { Mesh, Vector3 } from '@babylonjs/core';
import { IDestructible } from './IDestructible';

/**
 * 피격 가능한 대상에 대한 인터페이스.
 */
export interface ITarget extends IDestructible {
  /** 타겟 고유 ID */
  id: string; // IDestructible.id is optional, we enforce it here

  /** 타겟의 메쉬 */
  mesh: Mesh;

  /** 현재 체력 (IDestructible) */
  health: number;

  /** 최대 체력 */
  maxHealth: number;

  /** 데미지 입기 (Overrides IDestructible to add specific params) */
  // We need to match IDestructible first, then extend.
  // IDestructible: takeDamage(amount: number, attackerId?: string): void;
  // We want to keep 'part' info.
  // Let's change signature to:
  takeDamage(amount: number, attackerId?: string, part?: string, hitPoint?: Vector3): void;

  /** 타겟 파괴/사망 처리 */
  onDestroy(): void;
  // die(): void; (Inherited from IDestructible)

  /** 활성화 여부 */
  isActive: boolean;

  /** 타겟 타입 (sync용) */
  type: string;
  isMoving?: boolean;
}
