import { Scene, Vector3 } from '@babylonjs/core';
import { EnemyPawn } from '../EnemyPawn';
import { AIController } from '../controllers/AIController';
import { PlayerPawn } from '../PlayerPawn';

export class EnemyManager {
  private scene: Scene;
  private enemies: EnemyPawn[] = [];
  private controllers: AIController[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public spawnEnemies(spawnPoints: number[][], targetPlayer: PlayerPawn): void {
    spawnPoints.forEach((point, index) => {
      const position = Vector3.FromArray(point);
      const enemy = new EnemyPawn(this.scene, position);
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
