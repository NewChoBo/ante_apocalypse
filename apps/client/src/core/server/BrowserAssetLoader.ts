import { Scene, SceneLoader } from '@babylonjs/core';
import { IServerAssetLoader, LoadedModel } from '@ante/game-core';
import { Logger } from '@ante/common';

import dummy3Asset from '../../assets/models/dummy3.babylon';
import gunAsset from '../../assets/models/Gun.glb';

const logger = new Logger('BrowserAssetLoader');

/**
 * 브라우저 환경(Vite)에서 서버용 에셋을 로드하는 클래스.
 * 정적 import 방식을 사용하여 Vite 번들링에 포함되도록 합니다.
 */
const MODEL_MAP: Record<string, string> = {
  'dummy3.babylon': dummy3Asset,
  'Gun.glb': gunAsset,
};

export class BrowserAssetLoader implements IServerAssetLoader {
  public async loadModel(scene: Scene, modelName: string): Promise<LoadedModel> {
    const url = MODEL_MAP[modelName];

    if (!url) {
      logger.error(`Model not found in MODEL_MAP: ${modelName}`);
      throw new Error(`Model not found: ${modelName}`);
    }

    logger.info(`Loading model via BrowserAssetLoader: ${modelName} -> ${url}`);

    // rootUrl에 url을 전달하고 fileName은 빈 문자열로 설정하여 직접 로드
    const result = await SceneLoader.ImportMeshAsync('', url, '', scene);

    return {
      meshes: result.meshes,
      skeletons: result.skeletons,
    };
  }
}
