import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  ShadowGenerator,
  Mesh,
} from '@babylonjs/core';

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
      ground.material = mat;
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
      wall.material = mat;
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
      mesh.material = mat;
    });
  }
}
