import { Mesh, Vector3, Scene } from '@babylonjs/core';
import { BaseComponent, ComponentConstructor } from '../core/components/base/BaseComponent';

/**
 * Unreal의 Pawn 개념을 도입한 인터페이스.
 * 월드 내에서 존재하고, Controller에 의해 제어될 수 있는 물리적 실체를 정의합니다.
 */
export interface IPawn {
  /** Pawn의 타입 (StaticTarget, HumanoidEnemy 등) */
  type: string;

  /** Pawn이 가진 메인 메쉬 */
  mesh: Mesh;

  /** 현재 위치 */
  position: Vector3;

  /** 체력 */
  health: number;

  /** 최대 체력 */
  maxHealth: number;

  /** 활성화 여부 */
  isActive: boolean;

  /** 소유하고 있는 컨트롤러 ID (없으면 null) */
  controllerId: string | null;

  /** 고유 ID */
  id: string;

  /** 사망 상태 */
  isDead: boolean;

  /** 업데이트 우선순위 */
  readonly priority: number;

  /** 데미지 처리 */
  takeDamage(amount: number): void;

  /** Pawn 초기화 */
  initialize(scene: Scene): void;

  /** 매 프레임 업데이트 */
  tick(deltaTime: number): void;

  /** 컴포넌트 추가 */
  addComponent(component: BaseComponent): void;

  getComponent<T extends BaseComponent>(type: ComponentConstructor<T>): T | undefined;

  /** 자원 해제 */
  dispose(): void;
}
