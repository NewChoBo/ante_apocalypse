import { AbstractMesh, Vector3, Mesh } from '@babylonjs/core';
import { IWorldEntity } from './IWorldEntity';

export interface IPawn extends IWorldEntity {
  mesh: AbstractMesh | Mesh;
  get position(): Vector3;
  get rotation(): Vector3;

  // Component System
  addComponent(component: any): void;
  getComponent<T>(componentClass: new (...args: any[]) => T): T | null | undefined;

  // Controller
  controllerId?: string | null;

  dispose(): void;
}
