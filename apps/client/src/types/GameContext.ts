import type { Scene, UniversalCamera } from '@babylonjs/core';
import type { TickManager } from '@ante/game-core';
import type { INetworkManager } from '../core/interfaces/INetworkManager';
import type { WorldEntityManager } from '../core/systems/WorldEntityManager';

/**
 * 게임 내 모든 주요 객체가 공유하는 핵심 의존성 집합
 */
export interface GameContext {
  /** Babylon Scene */
  scene: Scene;

  /** 메인 플레이어 카메라 */
  camera: UniversalCamera;

  /** 프레임별 업데이트 관리 */
  tickManager: TickManager;

  /** 네트워크 통신 */
  networkManager: INetworkManager;

  /** 월드 엔티티 관리 */
  worldManager: WorldEntityManager;
}
