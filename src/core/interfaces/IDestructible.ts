/**
 * 파괴/사망 가능한 아이템에 대한 공통 인터페이스.
 * Player, Enemy, Target 등 모든 피해를 입고 파괴되는 객체가 구현해야 합니다.
 */
export interface IDestructible {
  /** 객체 고유 ID */
  id?: string;

  /** 현재 체력 */
  health: number;

  /** 사망/파괴 여부 */
  isDead: boolean; // or isActive (Target) - maybe abstract to isAlive? or just check health <= 0

  /** 데미지 처리 */
  takeDamage(amount: number, attackerId?: string): void;

  /** 사망/파괴 처리 (Visual, Logic) */
  die(): void;
}
