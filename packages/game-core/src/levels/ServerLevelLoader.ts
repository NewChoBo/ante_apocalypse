import { Scene, MeshBuilder, Vector3 } from '@babylonjs/core';
import { Logger } from '@ante/common';
import { LevelData } from './LevelData.js';

const logger = new Logger('ServerLevelLoader');

/**
 * 서버 측에서 레벨 지형(Collision Mesh)을 생성하는 클래스.
 * 렌더링 관련 속성(Material, Texture, Shadow)을 제외하고 물리 충돌에 필요한 데이터만 생성합니다.
 */
export class ServerLevelLoader {
  constructor(private scene: Scene) {}

  public loadLevelData(data: LevelData): void {
    try {
      this.buildLevel(data);
      logger.info('Server-side level geometry loaded.');
    } catch (e) {
      logger.error(`Failed to load server level data: ${e}`);
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
      ground.checkCollisions = true;
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
      wall.checkCollisions = true;
    });

    // 3. Props
    data.props.forEach((propData) => {
      if (propData.type === 'box') {
        const mesh = MeshBuilder.CreateBox(
          propData.name,
          {
            width: propData.size[0],
            height: propData.size[1],
            depth: propData.size[2],
          },
          this.scene
        );
        mesh.position = Vector3.FromArray(propData.position);
        mesh.checkCollisions = true;
      } else {
        const mesh = MeshBuilder.CreateCylinder(
          propData.name,
          {
            height: propData.size[0],
            diameter: propData.size[1],
          },
          this.scene
        );
        mesh.position = Vector3.FromArray(propData.position);
        mesh.checkCollisions = true;
      }
    });
  }
}
