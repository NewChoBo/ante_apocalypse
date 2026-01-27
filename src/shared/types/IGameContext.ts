import { Scene } from '@babylonjs/core';

/**

 * 게임의 핵심 매니저 및 서비스들에 접근하기 위한 추통 인터페이스.
 * 의존성 주입(DI) 및 서비스 로케이터 패턴의 기초가 됩니다.
 */
export interface IGameContext {
  /** 현재 활성 씬 */
  readonly scene: Scene;

  /** 자산 로더 (모델, 사운드 등) */
  readonly assetLoader: any; // Type should be AssetLoader

  /** 네트워크 매니저 */
  readonly networkManager: any; // Type should be NetworkManager

  /** 월드 엔티티 관리 (피격 처리 등) */
  readonly worldEntityManager: any;

  /** 효과 관리 (VFX) */
  readonly vfxManager: any;

  /** 사운드 관리 (Audio) */
  readonly audioManager: any;

  /** 현재 게임 모드 ('single' | 'multi') */
  readonly gameMode: string;
}
