import { IGameRule } from './IGameRule.js';
import { WorldSimulation } from '../simulation/WorldSimulation.js';
import { Vector3 } from '@babylonjs/core';

export class WaveSurvivalRule implements IGameRule {
  public onInitialize(simulation: WorldSimulation): void {
    // 1. Initial Target Spawns
    const distances = [10, 15, 20];

    for (let lane = 0; lane < 5; lane++) {
      const x = (lane - 2) * 7;
      distances.forEach((z) => {
        const isMoving = Math.random() > 0.5;
        const position = new Vector3(x, 1.0, z);
        const id = `target_${lane}_${z}_${Math.random().toString(36).substr(2, 4)}`;

        // Use exposed method on Spawner
        simulation.targets.spawnTargetAt(
          id,
          isMoving ? 'moving_target' : 'static_target',
          position,
          isMoving
        );
      });
    }

    // 2. Initial Enemies
    simulation.enemies.spawnEnemiesAt([
      [5, 0, 5],
      [-5, 0, 5],
    ]);
  }

  public onUpdate(_simulation: WorldSimulation, _deltaTime: number): void {
    // TODO: Wave Management, Check Win/Loss
  }

  public onPlayerJoin(_simulation: WorldSimulation, _playerId: string): void {
    // Dynamic scaling could go here
  }
}
