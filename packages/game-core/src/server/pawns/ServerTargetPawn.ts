import { Mesh, MeshBuilder, Vector3 } from '@babylonjs/core';
import { Logger } from '@ante/common';
import { BasePawn } from '../../simulation/BasePawn.js';
import { ServerGameContext } from '../../types/ServerGameContext.js';

const logger = new Logger('ServerTargetPawn');

/**
 * 서버측 타겟 Pawn 객체.
 */
export class ServerTargetPawn extends BasePawn {
  public override mesh: Mesh;
  public override type = 'target';

  constructor(
    id: string,
    private ctx: ServerGameContext,
    position: Vector3
  ) {
    super(ctx.scene, ctx.tickManager);
    this.id = id;

    // Matches Client StaticTarget: Cylinder { height: 0.1, diameter: 1.5 }
    this.mesh = MeshBuilder.CreateCylinder(id, { height: 0.1, diameter: 1.5 }, this.ctx.scene);
    this.mesh.rotation.x = Math.PI / 2;
    this.mesh.position.copyFrom(position);
    this.mesh.checkCollisions = true;
    this.mesh.isPickable = true;

    this.mesh.metadata = {
      id: this.id,
      targetId: this.id,
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

  public override dispose(): void {
    super.dispose();
  }
}
