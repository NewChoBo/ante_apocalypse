import { Scene, SceneLoader } from '@babylonjs/core';
import { IServerAssetLoader, LoadedModel } from '@ante/game-core';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@ante/common';

const logger = new Logger('NodeAssetLoader');

export class NodeAssetLoader implements IServerAssetLoader {
  public async loadModel(scene: Scene, modelName: string): Promise<LoadedModel> {
    const cwd = process.cwd();
    let modelDir = '';

    // Determine directory based on execution context
    if (cwd.endsWith('server') || cwd.endsWith('server\\')) {
      modelDir = path.join(cwd, 'assets/models/');
    } else {
      modelDir = path.join(cwd, 'apps/server/assets/models/');
    }

    const fullPath = path.join(modelDir, modelName);
    logger.info(`Loading model via fs: ${fullPath}`);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File DOES NOT EXIST at: ${fullPath}`);
    }

    // Read file directly to bypass xhr2/NetworkError issues
    const fileData = fs.readFileSync(fullPath, { encoding: 'base64' });
    const dataUrl = 'data:;base64,' + fileData;

    // rootUrl is the data string, fileName is empty
    const result = await SceneLoader.ImportMeshAsync('', dataUrl, '', scene);

    return {
      meshes: result.meshes,
      skeletons: result.skeletons,
    };
  }
}
