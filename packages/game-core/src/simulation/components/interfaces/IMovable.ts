import { Vector3 } from '@babylonjs/core';

/**
 * IMovable - 이동 가능한 컴포넌트 인터페이스
 *
 * AIComponent 등이 이동 기능을 사용할 때
 * 구체적인 MovementComponent가 아닌 이 인터페이스에 의존하도록 합니다.
 *
 * 이를 통해 느슨한 결합을 달성하고,
 * 다양한 이동 구현체(FlyingMovement, TeleportMovement 등)를
 * 쉽게 교체할 수 있습니다.
 */
export interface IMovable {
  /**
   * 지정된 방향으로 이동
   * @param direction 이동 방향 (정규화된 벡터)
   * @param speed 이동 속도 (선택적, 기본값 사용)
   */
  move(direction: Vector3, speed?: number): void;

  /**
   * 특정 위치로 이동
   * @param position 목표 위치
   * @param onArrival 도착 시 호출될 콜백
   */
  moveTo(position: Vector3, onArrival?: () => void): void;

  /**
   * 이동 정지
   */
  stop(): void;

  /**
   * 특정 지점을 바라보기
   * @param targetPoint 바라볼 지점
   */
  lookAt(targetPoint: Vector3): void;

  /**
   * 특정 위치로 순간 이동
   * @param position 목표 위치
   */
  teleport(position: Vector3): void;

  /**
   * 현재 속도 반환
   */
  getVelocity(): Vector3;

  /**
   * 현재 스피드 반환
   */
  getSpeed(): number;

  /**
   * 이동 중인지 확인
   */
  getIsMoving(): boolean;

  /**
   * 목표 지점까지의 남은 거리 반환
   * @param targetPosition 목표 위치
   */
  getRemainingDistance(targetPosition: Vector3): number;
}

/**
 * IMovable 인터페이스를 식별하기 위한 타입 가드
 */
export function isMovable(component: unknown): component is IMovable {
  if (typeof component !== 'object' || component === null) {
    return false;
  }

  const c = component as Record<string, unknown>;
  return (
    typeof c.move === 'function' &&
    typeof c.moveTo === 'function' &&
    typeof c.stop === 'function' &&
    typeof c.lookAt === 'function'
  );
}
