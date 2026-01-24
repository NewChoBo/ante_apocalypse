import { Scene, ShadowGenerator } from '@babylonjs/core';
import { LevelLoader } from '../core/systems/LevelLoader';

export class ShootingRange {
  private levelLoader: LevelLoader;

  constructor(scene: Scene, shadowGenerator: ShadowGenerator) {
    this.levelLoader = new LevelLoader(scene, shadowGenerator);
  }

  public async create(): Promise<void> {
    // JSON 데이터로부터 레벨 로드
    // public/levels/training_ground.json
    await this.levelLoader.loadLevel('/levels/training_ground.json');

    // 조명이나 데칼 등 동적인 요소가 있다면 여기서 추가 처리 가능
  }
}
