import { Vector3 } from '@babylonjs/core';

export interface IEnemyPawn {
  id: string;
  position: Vector3;
  rotation: Vector3;
  health: number;
  isDead: boolean;
  isMoving?: boolean;

  lookAt(targetPoint: Vector3): void;
  move(direction: Vector3, speed: number, deltaTime: number): void;
  dispose(): void;
}
