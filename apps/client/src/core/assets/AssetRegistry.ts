import {
  AssetContainer,
  InstantiatedEntries,
  Mesh,
  Nullable,
  Scene,
  SceneLoader,
  Texture,
} from '@babylonjs/core';

export type RegistryManifestItem = {
  key: string;
  asset: string;
  type: 'texture' | 'glb' | 'babylon';
};

export class AssetRegistry {
  public readonly glb: Record<string, AssetContainer> = {};
  public readonly babylon: Record<string, AssetContainer> = {};
  public readonly textures: Record<string, Texture> = {};

  public async load(scene: Scene, manifest: RegistryManifestItem[]): Promise<void> {
    await Promise.all(
      manifest.map(async (item) => {
        if (item.type === 'texture') {
          this.textures[item.key] = new Texture(item.asset, scene);
          return;
        }

        const container = await SceneLoader.LoadAssetContainerAsync('', item.asset, scene);
        if (item.type === 'glb') {
          this.glb[item.key] = container;
          return;
        }
        this.babylon[item.key] = container;
      })
    );
  }

  public instantiateModel(scene: Scene | null, key: string, rootName?: string): Nullable<InstantiatedEntries> {
    const container = this.glb[key] || this.babylon[key];
    if (!container) return null;

    const entries = container.instantiateModelsToScene(
      (n) => (rootName ? `${rootName}_${n}` : n),
      false,
      {
        doNotInstantiate: true,
      }
    );

    if (entries.rootNodes.length !== 1) {
      const wrapper = new Mesh(rootName || `${key}_wrapper`, scene);
      entries.rootNodes.forEach((node) => {
        node.parent = wrapper;
      });
      Object.defineProperty(entries, 'rootNodes', {
        value: [wrapper],
        writable: true,
      });
    }

    return entries;
  }

  public clear(): void {
    Object.values(this.glb).forEach((container) => container.dispose());
    Object.values(this.babylon).forEach((container) => container.dispose());
    Object.values(this.textures).forEach((texture) => texture.dispose());

    Object.keys(this.glb).forEach((key) => delete this.glb[key]);
    Object.keys(this.babylon).forEach((key) => delete this.babylon[key]);
    Object.keys(this.textures).forEach((key) => delete this.textures[key]);
  }
}
