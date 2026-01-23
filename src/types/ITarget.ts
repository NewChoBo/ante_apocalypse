import { Mesh, Vector3 } from '@babylonjs/core';

/**
 * 피격 가능한 대상에 대한 인터페이스.
 */
export interface ITarget {
  /** 타겟 고유 ID */
  id: string;

  /** 타겟의 메쉬 */
  mesh: Mesh;

  /** 현재 체력 */
  health: number;

  /** 최대 체력 */
  maxHealth: number;

  /** 데미지 입기 */
  takeDamage(amount: number, hitPoint?: Vector3): void;

  /** 타겟 파괴/사망 처리 */
  onDestroy(): void;

  /** 활성화 여부 */
  isActive: boolean;
}
