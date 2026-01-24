import { Scene, Vector3, ShadowGenerator } from '@babylonjs/core';
import { EnemyPawn } from '../EnemyPawn';
import { AIController } from '../controllers/AIController';
import { PlayerPawn } from '../PlayerPawn';

export class EnemyManager {
  private scene: Scene;
  private shadowGenerator: ShadowGenerator;
  private enemies: EnemyPawn[] = [];
  private controllers: AIController[] = [];

  constructor(scene: Scene, shadowGenerator: ShadowGenerator) {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
  }

  public spawnEnemies(spawnPoints: number[][], targetPlayer: PlayerPawn): void {
    spawnPoints.forEach((point, index) => {
      const position = Vector3.FromArray(point);
      const enemy = new EnemyPawn(this.scene, position, this.shadowGenerator);
      const controller = new AIController(`enemy_ai_${index}`, enemy, targetPlayer);

      this.enemies.push(enemy);
      this.controllers.push(controller);
    });
  }

  public dispose(): void {
    this.controllers.forEach((c) => c.dispose());
    this.enemies.forEach((e) => e.dispose());
    this.enemies = [];
    this.controllers = [];
  }
}
