import { Vector3 } from '@babylonjs/core';
import { BasePickupManager } from '../../systems/BasePickupManager.js';
import { IPickup } from '../../types/IPickup.js';

class ServerPickup implements IPickup {
  constructor(
    public id: string,
    public type: string,
    public position: Vector3
  ) {}

  dispose(): void {
    // Server cleanup if needed
  }
}

export class ServerPickupManager extends BasePickupManager {
  protected createPickup(id: string, type: string, position: Vector3): IPickup {
    return new ServerPickup(id, type, position);
  }
}
