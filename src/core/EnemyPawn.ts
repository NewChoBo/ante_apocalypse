import { Mesh, Vector3, Scene, StandardMaterial, Color3 } from '@babylonjs/core';
import { BasePawn } from './BasePawn';

export class EnemyPawn extends BasePawn {
  public mesh: Mesh;
  private health = 100;
  private isDead = false;

  constructor(scene: Scene, position: Vector3) {
    super(scene);

    // 적 모델 (빨간 박스)
    this.mesh = Mesh.CreateBox('enemy', 1.0, scene);
    this.mesh.position.copyFrom(position);
    this.mesh.checkCollisions = true;

    // 머티리얼 (빨강)
    const mat = new StandardMaterial('enemyMat', scene);
    mat.diffuseColor = new Color3(0.8, 0.1, 0.1);
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
    // 사망 애니메이션 또는 제거
    this.mesh.dispose();
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
