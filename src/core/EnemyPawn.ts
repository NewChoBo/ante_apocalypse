import { Mesh, Vector3, Scene, StandardMaterial, Color3, MeshBuilder } from '@babylonjs/core';
import { BasePawn } from './BasePawn';
import { PickupManager } from './systems/PickupManager';

export class EnemyPawn extends BasePawn {
  public mesh: Mesh;
  private health = 100;
  public isDead = false;

  constructor(scene: Scene, position: Vector3) {
    super(scene);

    // 적 모델 (Droid Geometry)
    // 1. Torso
    const torso = MeshBuilder.CreateCylinder('enemyTorso', { height: 0.9, diameter: 0.4 }, scene);
    torso.position.y = 0.9;

    // 2. Head
    const head = MeshBuilder.CreateSphere('enemyHead', { diameter: 0.35 }, scene);
    head.position.y = 1.6;

    // 3. Arms (One box across)
    const arms = MeshBuilder.CreateBox(
      'enemyArms',
      { width: 1.0, height: 0.1, depth: 0.15 },
      scene
    );
    arms.position.y = 1.1;

    // Merge meshes including position offsets
    // Note: MergeMeshes with transform updates is creating a single mesh.
    // The "pawn" logic assumes this.mesh is the main collider.
    // We should make sure the origin is at the bottom (0,0,0).
    // Our primitives are offsetted relative to (0,0,0) so merging them "as is" works if we don't parent them first (they are in world space), or we parent them to a root node.
    // Simpler: Just merge them.

    this.mesh = Mesh.MergeMeshes([torso, head, arms], true, true, undefined, false, true)!;

    // Ensure the mesh was created
    if (!this.mesh) {
      // Fallback
      this.mesh = MeshBuilder.CreateBox('enemyFallback', { size: 1 }, scene);
    }

    this.mesh.position.copyFrom(position);
    this.mesh.checkCollisions = true;

    // 머티리얼 (Metallic Red)
    const mat = new StandardMaterial('enemyMat', scene);
    mat.diffuseColor = new Color3(0.8, 0.1, 0.1);
    mat.specularColor = new Color3(1.0, 1.0, 1.0);
    this.mesh.material = mat;

    // 태그 설정 (레이캐스트 식별용)
    this.mesh.metadata = { type: 'enemy', pawn: this };
  }

  public initialize(_scene: Scene): void {
    // 필요한 경우 초기화 로직
  }

  public tick(deltaTime: number): void {
    this.updateComponents(deltaTime);
  }

  public takeDamage(amount: number): void {
    if (this.isDead) return;

    this.health -= amount;
    // 피격 이펙트 (간단히 색상 깜빡임 등)
    if (this.mesh.material instanceof StandardMaterial) {
      const originalColor = this.mesh.material.emissiveColor.clone();
      this.mesh.material.emissiveColor = new Color3(1, 1, 1);
      setTimeout(() => {
        if (!this.mesh || this.mesh.isDisposed()) return;
        (this.mesh.material as StandardMaterial).emissiveColor = originalColor;
      }, 100);
    }

    if (this.health <= 0) {
      this.die();
    }
  }

  private die(): void {
    this.isDead = true;
    console.log('Enemy Died');
    // 아이템 드롭
    PickupManager.getInstance().spawnRandomPickup(this.position);

    // 사망 애니메이션 또는 제거
    this.mesh.dispose();
    this.dispose();
  }

  public get position(): Vector3 {
    return this.mesh.position;
  }

  public lookAt(targetPoint: Vector3): void {
    this.mesh.lookAt(targetPoint);
  }

  public move(direction: Vector3, speed: number, deltaTime: number): void {
    this.mesh.moveWithCollisions(direction.scale(speed * deltaTime));
  }
}
