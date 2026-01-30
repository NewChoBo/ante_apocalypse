import { Scene, SceneLoader } from '@babylonjs/core';
import { IServerAssetLoader, LoadedModel } from '@ante/game-core';
import { Logger } from '@ante/common';

const logger = new Logger('BrowserAssetLoader');

export class BrowserAssetLoader implements IServerAssetLoader {
  public async loadModel(scene: Scene, modelName: string): Promise<LoadedModel> {
    // In browser (Vite dev), assets are served from /src/assets/models/
    const rootUrl = '/src/assets/models/';

    logger.info(`Loading model via BrowserAssetLoader: ${rootUrl + modelName}`);

    const result = await SceneLoader.ImportMeshAsync('', rootUrl, modelName, scene);

    return {
      meshes: result.meshes,
      skeletons: result.skeletons,
    };
  }
}
