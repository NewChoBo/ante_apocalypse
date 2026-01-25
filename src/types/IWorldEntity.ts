import { Mesh, AbstractMesh, Vector3 } from '@babylonjs/core';

export interface DamageProfile {
  multipliers: Record<string, number>;
  defaultMultiplier: number;
}

/**
 * 모든 월드 내 상호작용 가능한 개체(Player, Enemy, Target 등)의 공통 인터페이스.
 * WorldEntityManager를 통해 통합 관리됩니다.
 */
export interface IWorldEntity {
  id: string;

  /** 메인 메쉬 */
  mesh: Mesh | AbstractMesh;

  /** 위치 정보 */
  position: Vector3;

  /** 엔티티 타입 (enemy, target, player 등) */
  type: string;

  /** 체력 정보 */
  health: number;
  maxHealth: number;
  isActive: boolean;
  isDead: boolean;

  /** 보간용 데이터 (선택사항) */
  isMoving?: boolean;

  /** 데미지 배율 정보 */
  damageProfile?: DamageProfile;

  /** 데미지 처리 */
  takeDamage(amount: number, attackerId?: string, part?: string, hitPoint?: Vector3): void;

  /** 소멸 처리 */
  die(): void;

  /** 리소스 해제 */
  dispose(): void;
}
