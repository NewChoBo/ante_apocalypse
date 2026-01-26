import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  ShadowGenerator,
  Mesh,
  Texture,
} from '@babylonjs/core';
import diffUrl from '../../../assets/textures/ground_crackedMud_baseColor.png?url';
import normUrl from '../../../assets/textures/ground_crackedMud_normal.png?url';

export interface LevelData {
  ground: {
    width: number;
    height: number;
    material: { diffuse: number[]; specular: number[] };
  };
  walls: Array<{
    name: string;
    position: number[];
    size: number[];
    material: { diffuse: number[] };
  }>;
  props: Array<{
    type: 'box' | 'cylinder';
    name: string;
    position: number[];
    size: number[]; // [width, height, depth] or [height, diameter]
    material: { diffuse: number[]; emissive?: number[] };
  }>;
  playerSpawn?: number[]; // [x, y, z]
  enemySpawns?: number[][]; // [[x,y,z], [x,y,z], ...]
}

export class LevelLoader {
  private scene: Scene;
  private shadowGenerator: ShadowGenerator;

  constructor(scene: Scene, shadowGenerator: ShadowGenerator) {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
  }

  public async loadLevel(url: string): Promise<LevelData | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to load level: ${url}`);
      const data: LevelData = await response.json();
      this.buildLevel(data);
      return data;
    } catch (e) {
      console.error('LevelLoader error:', e);
      return null;
    }
  }

  public async loadLevelData(data: LevelData): Promise<void> {
    try {
      this.buildLevel(data);
    } catch (e) {
      console.error('LevelLoader error:', e);
    }
  }

  private buildLevel(data: LevelData): void {
    // 1. Ground
    if (data.ground) {
      const ground = MeshBuilder.CreateGround(
        'ground',
        { width: data.ground.width, height: data.ground.height },
        this.scene
      );
      ground.receiveShadows = true;
      ground.checkCollisions = true;
      const mat = new StandardMaterial('groundMat', this.scene);
      mat.diffuseColor = Color3.FromArray(data.ground.material.diffuse);
      mat.specularColor = Color3.FromArray(data.ground.material.specular);
      mat.freeze(); // Freeze material
      ground.material = mat;
      ground.freezeWorldMatrix(); // Freeze matrix
    }

    // 2. Walls
    data.walls.forEach((wallData) => {
      const wall = MeshBuilder.CreateBox(
        wallData.name,
        {
          width: wallData.size[0],
          height: wallData.size[1],
          depth: wallData.size[2],
        },
        this.scene
      );
      wall.position = Vector3.FromArray(wallData.position);
      wall.receiveShadows = true;
      wall.checkCollisions = true;
      this.shadowGenerator.addShadowCaster(wall);

      const mat = new StandardMaterial(`${wallData.name}Mat`, this.scene);
      mat.diffuseColor = Color3.FromArray(wallData.material.diffuse);

      // Apply Analyzed Textures
      if (wallData.name.includes('wall')) {
        const diffTex = new Texture(diffUrl, this.scene);
        diffTex.uScale = wallData.size[0] / 8;
        diffTex.vScale = wallData.size[1] / 8;
        mat.diffuseTexture = diffTex;

        const normTex = new Texture(normUrl, this.scene);
        normTex.uScale = wallData.size[0] / 8;
        normTex.vScale = wallData.size[1] / 8;
        mat.bumpTexture = normTex;
      }

      mat.freeze(); // Freeze material
      wall.material = mat;
      wall.freezeWorldMatrix(); // Freeze matrix
    });

    // 3. Props
    data.props.forEach((propData) => {
      let mesh: Mesh;
      if (propData.type === 'box') {
        mesh = MeshBuilder.CreateBox(
          propData.name,
          {
            width: propData.size[0],
            height: propData.size[1],
            depth: propData.size[2],
          },
          this.scene
        );
      } else {
        // cylinder: size [height, diameter]
        mesh = MeshBuilder.CreateCylinder(
          propData.name,
          {
            height: propData.size[0],
            diameter: propData.size[1],
          },
          this.scene
        );
      }

      mesh.position = Vector3.FromArray(propData.position);
      mesh.receiveShadows = true;
      mesh.checkCollisions = true;
      this.shadowGenerator.addShadowCaster(mesh);

      const mat = new StandardMaterial(`${propData.name}Mat`, this.scene);
      mat.diffuseColor = Color3.FromArray(propData.material.diffuse);
      if (propData.material.emissive) {
        mat.emissiveColor = Color3.FromArray(propData.material.emissive);
      }
      mat.freeze(); // Freeze material
      mesh.material = mat;
      mesh.freezeWorldMatrix(); // Freeze matrix
    });
  }
}
