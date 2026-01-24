import { Scene, SceneLoader, AbstractMesh, AssetContainer } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

/**
 * 전용 에셋 로더 (GLB/GLTF 전용)
 * 외부 모델을 수동으로 추가하고 싶을 때 사용
 */
export class AssetLoader {
  /**
   * 외부 GLB 파일을 로드하여 메쉬 배열을 반환
   * @param scene 현재 씬
   * @param rootUrl 파일 경로 (e.g., "/models/")
   * @param fileName 파일 이름 (e.g., "gun.glb")
   */
  public static async loadModel(
    scene: Scene,
    rootUrl: string,
    fileName: string
  ): Promise<AbstractMesh[]> {
    try {
      const result = await SceneLoader.ImportMeshAsync('', rootUrl, fileName, scene);
      return result.meshes;
    } catch (error) {
      console.error(`Failed to load model: ${fileName}`, error);
      throw error;
    }
  }

  /**
   * 에셋 컨테이너를 시용하여 미리 로드해두고 필요할 때 인스턴스화
   */
  public static async loadToContainer(
    scene: Scene,
    rootUrl: string,
    fileName: string
  ): Promise<AssetContainer> {
    return SceneLoader.LoadAssetContainerAsync(rootUrl, fileName, scene);
  }
}
