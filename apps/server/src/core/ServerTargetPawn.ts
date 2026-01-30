import { Mesh, MeshBuilder, Scene, Vector3 } from '@babylonjs/core';

export class ServerTargetPawn {
  public mesh: Mesh;
  public id: string;

  constructor(id: string, scene: Scene, position: Vector3) {
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

    console.log(`[Server] Created Target Pawn ${id} at ${position}`);
  }

  public dispose() {
    this.mesh.dispose();
  }
}
