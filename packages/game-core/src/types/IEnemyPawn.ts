import { Vector3 } from '@babylonjs/core';

export interface IEnemyPawn {
  id: string;
  position: Vector3;
  isDead: boolean;

  lookAt(targetPoint: Vector3): void;
  move(direction: Vector3, speed: number, deltaTime: number): void;
  dispose(): void;
}
