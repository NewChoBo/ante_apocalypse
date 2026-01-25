import {
  Mesh,
  Vector3,
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  ShadowGenerator,
  Animation,
} from '@babylonjs/core';
import { BaseTarget } from './BaseTarget';
import { NetworkManager } from '../core/systems/NetworkManager';

/**
 * 이동 타겟 구현체.
 * 좌우로 움직이는 사격 표적입니다.
 */
export class MovingTarget extends BaseTarget {
  public id: string;
  public mesh: Mesh;
  public type: string = 'moving_target';
  public isMoving: boolean = true;
  private shadowGenerator: ShadowGenerator;
  private basePosition: Vector3;

  constructor(scene: Scene, id: string, position: Vector3, shadowGenerator: ShadowGenerator) {
    super(scene, 100);
    this.id = id;
    this.shadowGenerator = shadowGenerator;
    this.basePosition = position.clone();
    this.mesh = this.createMesh(position);
    this.damageProfile = {
      multipliers: { head: 3.0, body: 1.0 },
      defaultMultiplier: 1.0,
    };
    this.startSyncedMovement();
  }

  private createMesh(position: Vector3): Mesh {
    const target = MeshBuilder.CreateCylinder(this.id, { height: 0.1, diameter: 1.5 }, this.scene);
    target.rotation.x = Math.PI / 2;
    target.position = position;
    target.isPickable = true;

    const material = new StandardMaterial(`${this.id}Mat`, this.scene);
    material.diffuseColor = new Color3(0.2, 0.6, 0.9); // 파란색 계열로 구분
    material.emissiveColor = new Color3(0.05, 0.15, 0.25);
    target.material = material;

    this.shadowGenerator.addShadowCaster(target);
    target.metadata = { targetId: this.id };

    // 중앙 원 (노란색)
    const center = MeshBuilder.CreateCylinder(
      `${this.id}_center`,
      { height: 0.12, diameter: 0.4 },
      this.scene
    );
    center.rotation.x = Math.PI / 2;
    center.parent = target;
    center.position = new Vector3(0, 0.02, 0);
    center.isPickable = false;

    const centerMat = new StandardMaterial(`${this.id}CenterMat`, this.scene);
    centerMat.diffuseColor = new Color3(1, 0.9, 0.2);
    centerMat.emissiveColor = new Color3(0.3, 0.27, 0.06);
    center.material = centerMat;

    return target;
  }

  private startSyncedMovement(): void {
    const networkManager = NetworkManager.getInstance();
    const moveRange = 2;
    const speed = 0.002; // Roughly matching the previous 120 frames at 30fps (4 sec cycle)

    this.scene.onBeforeRenderObservable.add(() => {
      if (!this.isActive || this.mesh.isDisposed()) return;

      const serverTime = networkManager.getServerTime();
      // Sinusoidal movement based on server time: -moveRange to +moveRange
      // Math.sin range is -1 to 1.
      // Cycle: 2 * Math.PI.
      const phase = serverTime * speed;
      this.mesh.position.x = this.basePosition.x + Math.sin(phase) * moveRange;
    });
  }

  protected onHit(_amount: number, _hitPoint?: Vector3): void {
    const material = this.mesh.material as StandardMaterial;
    if (!material) return;

    const originalColor = material.diffuseColor.clone();
    material.diffuseColor = new Color3(1, 1, 1);

    setTimeout(() => {
      material.diffuseColor = originalColor;
    }, 50);
  }

  public onDestroy(): void {
    console.log(`[MovingTarget] onDestroy called for ${this.id}`);
    this.playDestroyAnimation();
  }

  private playDestroyAnimation(): void {
    if (!this.mesh || this.mesh.isDisposed()) return;

    // 기존 이동 애니메이션 중지 (매우 중요)
    this.scene.stopAnimation(this.mesh);

    const scaleAnim = new Animation(
      'destroyScale',
      'scaling',
      60,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    scaleAnim.setKeys([
      { frame: 0, value: this.mesh.scaling.clone() },
      { frame: 5, value: new Vector3(1.2, 1.2, 1.2) },
      { frame: 20, value: new Vector3(0, 0, 0) },
    ]);

    this.mesh.animations = [scaleAnim];
    this.scene.beginAnimation(this.mesh, 0, 20, false, 1, () => {
      console.log(`[MovingTarget] Animation ended, disposing mesh for ${this.id}`);
      this.mesh.dispose();
    });
  }
}
