import type { Scene } from '@babylonjs/core';
import type { TickManager } from '../systems/TickManager';
import type { IServerNetworkAuthority } from '../server/IServerNetworkAuthority';
import type { WorldEntityManager } from '../simulation/WorldEntityManager';

/**
 * 서버측 게임 컨텍스트
 */
export interface ServerGameContext {
  /** Babylon Scene (NullEngine 기반) */
  scene: Scene;

  /** 프레임별 업데이트 관리 */
  tickManager: TickManager;

  /** 네트워크 서버 권한체 */
  networkManager: IServerNetworkAuthority;

  /** 월드 엔티티 관리 */
  worldManager: WorldEntityManager;
}
