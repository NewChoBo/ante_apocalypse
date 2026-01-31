import { Vector3 } from '@babylonjs/core';

export interface IPickup {
  id: string;
  type: string;
  position: Vector3;
  dispose(): void;
}
