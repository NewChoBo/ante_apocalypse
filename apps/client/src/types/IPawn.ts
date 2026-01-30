import { Mesh, Vector3, Scene } from '@babylonjs/core';

/**
 * Unreal의 Pawn 개념을 도입한 인터페이스.
 * 월드 내에서 존재하고, Controller에 의해 제어될 수 있는 물리적 실체를 정의합니다.
 */
export interface IPawn {
  /** Pawn이 가진 메인 메쉬 */
  mesh: Mesh;

  /** 현재 위치 */
  position: Vector3;

  /** 체력 */
  health: number;

  /** 소유하고 있는 컨트롤러 ID (없으면 null) */
  controllerId: string | null;

  /** 고유 ID */
  id: string;

  /** 사망 상태 */
  isDead: boolean;

  /** 데미지 처리 */
  takeDamage(amount: number): void;

  /** Pawn 초기화 */
  initialize(scene: Scene): void;

  /** 매 프레임 업데이트 */
  tick(deltaTime: number): void;

  /** 자원 해제 */
  dispose(): void;
}
