import { Mesh, Vector3, AbstractMesh, MeshBuilder, Scene, Node } from '@babylonjs/core';
import { AssetLoader, GameAssets } from '../core/loaders/AssetLoader';

export interface WeaponCreationOptions {
  assetName: keyof GameAssets;
  targetSize: number;
  parent?: Node | null;
  position?: Vector3;
  rotation?: Vector3;
  scalingZMultiplier?: number;
  materialTinter?: (mesh: Mesh) => void;
  isPickable?: boolean; // Default false
  receiveShadows?: boolean; // Default true
}

export class WeaponUtils {
  /**
   * Creates a weapon mesh from assets, handling scaling, normalization, and material application.
   */
  public static async createWeaponMesh(
    scene: Scene,
    options: WeaponCreationOptions
  ): Promise<AbstractMesh | null> {
    const {
      assetName,
      targetSize,
      parent,
      position = Vector3.Zero(),
      rotation = Vector3.Zero(),
      scalingZMultiplier = 1.0,
      materialTinter,
      isPickable = false,
      receiveShadows = true,
    } = options;

    try {
      const entries = AssetLoader.getInstance().instantiateMesh(assetName);

      if (!entries) {
        throw new Error(
          `Asset '${assetName}' not preloaded. Loader status: isReady=${AssetLoader.getInstance().ready}`
        );
      }

      const weaponMesh = entries.rootNodes[0] as AbstractMesh;
      if (!weaponMesh) {
        throw new Error(`Failed to find root node in asset '${assetName}'`);
      }

      // --- Normalization ---
      weaponMesh.parent = null;
      weaponMesh.rotationQuaternion = null;
      weaponMesh.rotation = Vector3.Zero();
      weaponMesh.scaling = Vector3.One();

      // --- Scaling ---
      const hierarchy = weaponMesh.getHierarchyBoundingVectors();
      const size = hierarchy.max.subtract(hierarchy.min);
      const maxDim = Math.max(size.x, size.y, size.z);

      const scaleFactor = targetSize / (maxDim || 1);
      weaponMesh.scaling = new Vector3(scaleFactor, scaleFactor, scaleFactor * scalingZMultiplier);

      // --- Positioning ---
      if (parent) {
        weaponMesh.parent = parent;
      }
      weaponMesh.position = position;
      weaponMesh.rotation = rotation;

      // --- Materials & Shadows ---
      const allMeshes = weaponMesh.getChildMeshes(false);
      allMeshes.forEach((m) => {
        if (m instanceof Mesh) {
          m.receiveShadows = receiveShadows;
          m.isPickable = isPickable;
          if (materialTinter) {
            materialTinter(m);
          }
        }
      });

      return weaponMesh;
    } catch (e) {
      console.error(`[WeaponUtils] Failed to instantiate ${assetName}:`, e);
      // Fallback
      const fallback = MeshBuilder.CreateBox(`${assetName}_fallback`, { size: 0.1 }, scene);
      if (parent) fallback.parent = parent;
      fallback.position = position;
      return fallback;
    }
  }
}
