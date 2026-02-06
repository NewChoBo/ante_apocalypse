import { Mesh, MeshBuilder, Vector3 } from '@babylonjs/core';
import { Logger } from '@ante/common';
import { BasePawn } from '../../simulation/BasePawn.js';
import { IEnemyPawn } from '../../types/IEnemyPawn.js';
import { ServerGameContext } from '../../types/ServerGameContext.js';

const logger = new Logger('ServerEnemyPawn');

/**
 * 서버측 적 Pawn 객체.
 */
export class ServerEnemyPawn extends BasePawn implements IEnemyPawn {
  public override mesh: Mesh;
  public headBox: Mesh;
  public override type = 'enemy';

  constructor(
    id: string,
    private ctx: ServerGameContext,
    position: Vector3
  ) {
    super(ctx.scene, ctx.tickManager);
    this.id = id;

    // 1. Root Collider (Pivot at feet: 0.0m)
    this.mesh = MeshBuilder.CreateBox(
      'enemyRoot_' + id,
      { width: 0.5, height: 2, depth: 0.5 },
      this.ctx.scene
    );
    this.mesh.setPivotPoint(new Vector3(0, -1, 0));
    this.mesh.position.copyFrom(position);
    this.mesh.checkCollisions = true;
    this.mesh.isPickable = true;
    this.mesh.metadata = { type: 'enemy', id: this.id, bodyPart: 'body', pawn: this };

    // 2. Head Hitbox
    this.headBox = MeshBuilder.CreateBox('headBox_' + id, { size: 0.25 }, this.ctx.scene);
    this.headBox.parent = this.mesh;
    this.headBox.position = new Vector3(0, 1.75, 0);
    this.headBox.checkCollisions = true;
    this.headBox.isPickable = true;
    this.headBox.metadata = { type: 'enemy', id: this.id, bodyPart: 'head', pawn: this };

    logger.info(`Created Enemy Pawn ${id} at ${position}`);
  }

  public tick(deltaTime: number): void {
    this.updateComponents(deltaTime);
  }

  protected onDeath(): void {
    logger.info(`ServerEnemyPawn ${this.id} died.`);
  }

  public lookAt(targetPoint: Vector3): void {
    this.mesh.lookAt(targetPoint);
  }

  public move(direction: Vector3, speed: number, deltaTime: number): void {
    const moveVec = direction.scale(speed * deltaTime);
    this.mesh.position.addInPlace(moveVec);
  }

  public override dispose(): void {
    super.dispose();
  }
}
