import { Scene, MeshBuilder, Vector3, StandardMaterial, Color3, Mesh } from '@babylonjs/core';

/**
 * Mesh part type definition
 */
type MeshPartType = 'cylinder' | 'box' | 'sphere';

/**
 * Mesh part config interface
 */
interface MeshPartConfig {
  type: MeshPartType;
  name: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  options: {
    height?: number;
    diameter?: number;
    width?: number;
    depth?: number;
    diameterBottom?: number;
    diameterTop?: number;
  };
}

/**
 * Material config interface
 */
interface MaterialConfig {
  diffuseColor: { r: number; g: number; b: number };
  specularColor?: { r: number; g: number; b: number };
  emissiveColor?: { r: number; g: number; b: number };
}

/**
 * Weapon mesh config interface
 */
export interface WeaponMeshConfig {
  name: string;
  parts: {
    mesh: MeshPartConfig;
    material: MaterialConfig;
    shareMaterial?: string; // 다른 파트와 머티리얼 공유 시 이름
  }[];
}

/**
 * Procedural mesh weapon builder
 * Provides procedural melee weapon mesh generation via static methods
 */
export class ProceduralWeaponBuilder {
  /**
   * Create mesh part from config
   */
  private static createPart(partConfig: MeshPartConfig, scene: Scene): Mesh {
    let mesh: Mesh;

    switch (partConfig.type) {
      case 'cylinder': {
        const options: {
          height: number;
          diameter?: number;
          diameterBottom?: number;
          diameterTop?: number;
        } = {
          height: partConfig.options.height || 0.1,
        };
        if (partConfig.options.diameter) {
          options.diameter = partConfig.options.diameter;
        } else if (
          partConfig.options.diameterBottom !== undefined &&
          partConfig.options.diameterTop !== undefined
        ) {
          options.diameterBottom = partConfig.options.diameterBottom;
          options.diameterTop = partConfig.options.diameterTop;
        }
        mesh = MeshBuilder.CreateCylinder(partConfig.name, options, scene);
        break;
      }
      case 'box':
        mesh = MeshBuilder.CreateBox(
          partConfig.name,
          {
            width: partConfig.options.width || 0.1,
            height: partConfig.options.height || 0.1,
            depth: partConfig.options.depth || 0.1,
          },
          scene
        );
        break;
      case 'sphere':
        mesh = MeshBuilder.CreateSphere(
          partConfig.name,
          {
            diameter: partConfig.options.diameter || 0.1,
          },
          scene
        );
        break;
      default:
        throw new Error(`Unknown mesh part type: ${partConfig.type}`);
    }

    mesh.position = new Vector3(
      partConfig.position.x,
      partConfig.position.y,
      partConfig.position.z
    );

    if (partConfig.rotation) {
      mesh.rotation = new Vector3(
        partConfig.rotation.x,
        partConfig.rotation.y,
        partConfig.rotation.z
      );
    }

    return mesh;
  }

  /**
   * 머티리얼 설정 적용
   */
  private static createMaterial(
    matConfig: MaterialConfig,
    name: string,
    scene: Scene
  ): StandardMaterial {
    const material = new StandardMaterial(name, scene);
    material.diffuseColor = new Color3(
      matConfig.diffuseColor.r,
      matConfig.diffuseColor.g,
      matConfig.diffuseColor.b
    );

    if (matConfig.specularColor) {
      material.specularColor = new Color3(
        matConfig.specularColor.r,
        matConfig.specularColor.g,
        matConfig.specularColor.b
      );
    }

    if (matConfig.emissiveColor) {
      material.emissiveColor = new Color3(
        matConfig.emissiveColor.r,
        matConfig.emissiveColor.g,
        matConfig.emissiveColor.b
      );
    }

    return material;
  }

  /**
   * Create weapon mesh from config
   */
  public static createFromConfig(config: WeaponMeshConfig, scene: Scene): Mesh | null {
    const meshes: Mesh[] = [];
    const sharedMaterials: Map<string, StandardMaterial> = new Map();

    for (const part of config.parts) {
      const mesh = this.createPart(part.mesh, scene);

      // 머티리얼 적용
      if (part.shareMaterial) {
        // 다른 파트와 머티리얼 공유
        let sharedMat = sharedMaterials.get(part.shareMaterial);
        if (!sharedMat) {
          sharedMat = this.createMaterial(part.material, `${part.shareMaterial}Mat`, scene);
          sharedMaterials.set(part.shareMaterial, sharedMat);
        }
        mesh.material = sharedMat;
      } else {
        const material = this.createMaterial(part.material, `${part.mesh.name}Mat`, scene);
        mesh.material = material;
      }

      meshes.push(mesh);
    }

    if (meshes.length === 0) return null;

    return Mesh.MergeMeshes(meshes, true, true, undefined, false, true);
  }

  /**
   * Create Knife mesh
   */
  public static createKnife(scene: Scene): Mesh | null {
    const config: WeaponMeshConfig = {
      name: 'KnifeMesh_Proc',
      parts: [
        // Handle
        {
          mesh: {
            type: 'cylinder',
            name: 'knifeHandle',
            position: { x: 0, y: 0, z: 0 },
            options: { height: 0.12, diameter: 0.03 },
          },
          material: {
            diffuseColor: { r: 0.1, g: 0.1, b: 0.1 }, // Black grip
          },
        },
        // Guard (Crossguard)
        {
          mesh: {
            type: 'box',
            name: 'knifeGuard',
            position: { x: 0, y: 0.065, z: 0 }, // Top of handle
            options: { width: 0.08, height: 0.015, depth: 0.02 },
          },
          material: {
            diffuseColor: { r: 0.3, g: 0.3, b: 0.3 }, // Dark Grey
            specularColor: { r: 0.8, g: 0.8, b: 0.8 },
          },
        },
        // Blade
        {
          mesh: {
            type: 'box',
            name: 'knifeBlade',
            position: { x: 0, y: 0.16, z: 0 }, // Above guard
            options: { width: 0.03, height: 0.18, depth: 0.005 },
          },
          material: {
            diffuseColor: { r: 1, g: 1, b: 1 }, // White
            specularColor: { r: 1, g: 1, b: 1 },
            emissiveColor: { r: 0.1, g: 0.1, b: 0.1 }, // Slight shine
          },
        },
      ],
    };

    return this.createFromConfig(config, scene);
  }

  /**
   * Create Bat mesh
   */
  public static createBat(scene: Scene): Mesh | null {
    const config: WeaponMeshConfig = {
      name: 'BatMesh_Proc',
      parts: [
        // Knob (Bottom)
        {
          mesh: {
            type: 'sphere',
            name: 'batKnob',
            position: { x: 0, y: -0.38, z: 0 }, // Bottom end
            options: { diameter: 0.06 },
          },
          material: {
            diffuseColor: { r: 0.5, g: 0.35, b: 0.2 }, // Wood
          },
          shareMaterial: 'wood',
        },
        // Grip (Handle)
        {
          mesh: {
            type: 'cylinder',
            name: 'batGrip',
            position: { x: 0, y: -0.25, z: 0 }, // Above knob
            options: { height: 0.25, diameter: 0.035 },
          },
          material: {
            diffuseColor: { r: 0.1, g: 0.1, b: 0.1 }, // Tape/Grip
          },
        },
        // Body (Tapered barrel)
        {
          mesh: {
            type: 'cylinder',
            name: 'batBody',
            position: { x: 0, y: 0.15, z: 0 }, // Above grip
            options: { height: 0.55, diameterBottom: 0.035, diameterTop: 0.07 },
          },
          material: {
            diffuseColor: { r: 0.6, g: 0.4, b: 0.25 }, // Light Wood
          },
          shareMaterial: 'wood',
        },
        // Cap (Top rounded)
        {
          mesh: {
            type: 'sphere',
            name: 'batCap',
            position: { x: 0, y: 0.425, z: 0 }, // Top of body
            options: { diameter: 0.07 },
          },
          material: {
            diffuseColor: { r: 0.6, g: 0.4, b: 0.25 }, // Light Wood (same as body)
          },
          shareMaterial: 'wood',
        },
      ],
    };

    return this.createFromConfig(config, scene);
  }
}
