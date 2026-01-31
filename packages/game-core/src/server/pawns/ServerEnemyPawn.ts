import { Mesh, MeshBuilder, Scene, Vector3 } from '@babylonjs/core';
import { Logger } from '@ante/common';
import { BasePawn } from '../../simulation/BasePawn.js';
import { IEnemyPawn } from '../../types/IEnemyPawn.js';

const logger = new Logger('ServerEnemyPawn');

export class ServerEnemyPawn extends BasePawn implements IEnemyPawn {
  public override mesh: Mesh;
  public headBox: Mesh;
  public override type = 'enemy';

  constructor(id: string, scene: Scene, position: Vector3) {
    super(scene);
    this.id = id;

    // 1. Root Collider (Pivot at feet: 0.0m)
    this.mesh = MeshBuilder.CreateBox(
      'enemyRoot_' + id,
      { width: 0.5, height: 2, depth: 0.5 },
      scene
    );
    this.mesh.setPivotPoint(new Vector3(0, -1, 0));
    this.mesh.position.copyFrom(position);
    this.mesh.checkCollisions = true;
    this.mesh.isPickable = true;
    this.mesh.metadata = { type: 'enemy', id: this.id, bodyPart: 'body', pawn: this };

    // 2. Head Hitbox
    // Client attaches this to the skeleton head bone.
    // Server doesn't have skeletons, so we approximate the position relative to the root.
    // Standard YBot head is roughly at height ~1.6-1.7m inside the 2m capsule.
    // Parent root is at center (Y=1.0 relative to ground).
    // Head relative to root center: ~0.7?

    this.headBox = MeshBuilder.CreateBox('headBox_' + id, { size: 0.25 }, scene);
    this.headBox.parent = this.mesh;

    // Adjust this value to match the visual mesh's head bone position
    // If root is 2m tall centered at 1m, top is at 2m. Head is likely near 1.75m.
    // Relative position = 1.75 - 1.0 = 0.75
    this.headBox.position = new Vector3(0, 1.75, 0);
    this.headBox.checkCollisions = true;
    this.headBox.isPickable = true;
    this.headBox.metadata = { type: 'enemy', id: this.id, bodyPart: 'head', pawn: this };

    logger.info(`Created Enemy Pawn ${id} at ${position}`);
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
    logger.info(`ServerEnemyPawn ${this.id} died.`);
  }

  public lookAt(targetPoint: Vector3): void {
    this.mesh.lookAt(targetPoint);
  }

  public move(direction: Vector3, speed: number, deltaTime: number): void {
    const moveVec = direction.scale(speed * deltaTime);
    // Simple position update for server, or moveWithCollisions if needed
    // this.mesh.moveWithCollisions(moveVec);
    // Since NullEngine collisions can be tricky without physics engine, direct move is safer for basic AI logic unless obstacles are critical.
    this.mesh.position.addInPlace(moveVec);
  }

  public override dispose() {
    super.dispose();
  }
}
