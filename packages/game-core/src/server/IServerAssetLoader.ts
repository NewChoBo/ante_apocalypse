import { Scene, AbstractMesh, Skeleton } from '@babylonjs/core';

export interface LoadedModel {
  meshes: AbstractMesh[];
  skeletons: Skeleton[];
}

/**
 * 서버 로직에서 에셋(모델 등)을 로드하기 위한 추상 인터페이스.
 * Node.js 환경(fs)과 브라우저 환경(fetch/SceneLoader)을 분리합니다.
 */
export interface IServerAssetLoader {
  /**
   * 모델 파일 로드
   * @param scene Babylon Scene
   * @param modelName 모델 파일명 (예: "dummy3.babylon", "targets.glb")
   * @returns 로드된 메쉬 및 스켈레톤 정보
   */
  loadModel(scene: Scene, modelName: string): Promise<LoadedModel>;
}
