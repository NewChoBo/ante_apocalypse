import { Mesh, MeshBuilder, Scene, Vector3 } from '@babylonjs/core';

export class ServerEnemyPawn {
  public mesh: Mesh;
  public headBox: Mesh;
  public id: string;
  public isDead = false;

  constructor(id: string, scene: Scene, position: Vector3) {
    this.id = id;

    // 1. Root Collider (Body) - Matches client's root collider
    // Client: Box { width: 0.5, height: 2, depth: 0.5 }
    // Positioned at y += 1.0 (Pivot center)
    this.mesh = MeshBuilder.CreateBox(
      'enemyRoot_' + id,
      { width: 0.5, height: 2, depth: 0.5 },
      scene
    );
    this.mesh.position.copyFrom(position);
    this.mesh.position.y += 1.0;
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
    this.headBox.position = new Vector3(0, 0.75, 0);

    this.headBox.checkCollisions = true;
    this.headBox.isPickable = true;
    this.headBox.metadata = { type: 'enemy', id: this.id, bodyPart: 'head', pawn: this };

    console.log(`[Server] Created Enemy Pawn ${id} at ${position}`);
  }

  public dispose() {
    this.mesh.dispose(); // Children (headBox) are disposed automatically
  }
}
