import { Scene, ShadowGenerator } from '@babylonjs/core';
import { LevelLoader, LevelData } from '../core/systems/LevelLoader';

export class ShootingRange {
  private levelLoader: LevelLoader;

  constructor(scene: Scene, shadowGenerator: ShadowGenerator) {
    this.levelLoader = new LevelLoader(scene, shadowGenerator);
  }

  public async create(levelUrl: string): Promise<LevelData | null> {
    return await this.levelLoader.loadLevel(levelUrl);
  }
}
