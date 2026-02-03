import { Vector3 } from '@babylonjs/core';

/**
 * 경로 정보
 */
export interface Path {
  /** 경로 상의 지점들 */
  waypoints: Vector3[];
  /** 총 경로 길이 */
  totalDistance: number;
  /** 경로가 유효한지 여부 */
  isValid: boolean;
}

/**
 * IPathfinding - 경로 탐색 인터페이스
 *
 * AIComponent가 경로 탐색이 필요할 때 사용하는 인터페이스입니다.
 * NavMesh, A* 알고리즘 등 다양한 구현체를 교체할 수 있습니다.
 */
export interface IPathfinding {
  /**
   * 시작점에서 목표점까지의 경로 계산
   * @param start 시작 위치
   * @param goal 목표 위치
   * @returns 계산된 경로
   */
  findPath(start: Vector3, goal: Vector3): Path;

  /**
   * 위치가 이동 가능한지 확인
   * @param position 확인할 위치
   * @returns 이동 가능 여부
   */
  isWalkable(position: Vector3): boolean;

  /**
   * 주어진 위치에서 가장 가까운 이동 가능한 위치 반환
   * @param position 기준 위치
   * @returns 가장 가까운 이동 가능한 위치
   */
  getNearestWalkablePosition(position: Vector3): Vector3;
}

/**
 * IPathfinding 인터페이스를 식별하기 위한 타입 가드
 */
export function hasPathfinding(component: unknown): component is IPathfinding {
  if (typeof component !== 'object' || component === null) {
    return false;
  }

  const c = component as Record<string, unknown>;
  return typeof c.findPath === 'function' && typeof c.isWalkable === 'function';
}
