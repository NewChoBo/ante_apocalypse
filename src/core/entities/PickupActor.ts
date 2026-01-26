import { Mesh, Scene, Vector3, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core';

export type PickupType = 'health_pack' | 'ammo_box';

export class PickupActor {
  public mesh: Mesh;
  public type: PickupType;
  private lifeTime = 15; // 15 seconds
  private timeAlive = 0;
  private isCollected = false;
  private baseY = 0;

  constructor(scene: Scene, position: Vector3, type: PickupType) {
    this.type = type;

    // Create visual representation
    this.mesh = MeshBuilder.CreateBox('pickup', { size: 0.3 }, scene);
    this.mesh.position.copyFrom(position);
    this.mesh.position.y += 0.5; // Spawn slightly above ground
    this.baseY = this.mesh.position.y;

    const mat = new StandardMaterial('pickupMat', scene);
    if (type === 'health_pack') {
      mat.diffuseColor = new Color3(0, 1, 0); // Green
      mat.emissiveColor = new Color3(0, 0.2, 0);
    } else {
      mat.diffuseColor = new Color3(0, 0.5, 1); // Blue
      mat.emissiveColor = new Color3(0, 0, 0.2);
    }
    this.mesh.material = mat;
  }

  public update(deltaTime: number): void {
    if (this.isCollected) return;

    this.timeAlive += deltaTime;

    // Floating/Rotating animation
    this.mesh.rotation.y += deltaTime * 2;
    this.mesh.position.y = this.baseY + Math.sin(this.timeAlive * 3) * 0.1;

    // Expiry check
    if (this.timeAlive >= this.lifeTime) {
      this.dispose();
    }
  }

  public collect(): void {
    this.isCollected = true;
    this.dispose();
  }

  public dispose(): void {
    if (this.mesh) {
      this.mesh.dispose();
    }
  }

  public get position(): Vector3 {
    return this.mesh.position;
  }

  public get destroyed(): boolean {
    return this.isCollected || this.timeAlive >= this.lifeTime;
  }

  public set destroyed(value: boolean) {
    this.isCollected = value;
  }
}
