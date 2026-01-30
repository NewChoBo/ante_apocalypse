import { Mesh, MeshBuilder, Scene, Vector3 } from '@babylonjs/core';
import { Logger } from '@ante/common';
import { BasePawn } from '@ante/game-core';

const logger = new Logger('ServerTargetPawn');

export class ServerTargetPawn extends BasePawn {
  public override mesh: Mesh;
  public override type = 'target';

  constructor(id: string, scene: Scene, position: Vector3) {
    super(scene);
    this.id = id;

    // Matches Client StaticTarget: Cylinder { height: 0.1, diameter: 1.5 }
    this.mesh = MeshBuilder.CreateCylinder(id, { height: 0.1, diameter: 1.5 }, scene);
    this.mesh.rotation.x = Math.PI / 2;
    this.mesh.position.copyFrom(position);
    this.mesh.checkCollisions = true;
    this.mesh.isPickable = true;

    // Key: Metadata must exactly match what the client sends/server expects
    // Client StaticTarget metadata: { targetId: this.id }
    // Server validation expects: mesh.metadata.id === data.targetId
    this.mesh.metadata = {
      id: this.id, // Unified ID field for server validation logic
      targetId: this.id, // For compatibility/reference
      type: 'target',
    };

    logger.info(`Created Target Pawn ${id} at ${position}`);
  }

  public tick(deltaTime: number): void {
    this.updateComponents(deltaTime);
  }

  public takeDamage(amount: number): void {
    if (this.isDead) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.die();
    }
  }

  public die(): void {
    this.isDead = true;
    this.health = 0;
    logger.info(`ServerTargetPawn ${this.id} destroyed.`);
  }

  public override dispose() {
    super.dispose();
  }
}
