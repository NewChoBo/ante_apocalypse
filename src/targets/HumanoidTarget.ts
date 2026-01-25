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

/**
 * 인간형 타겟 구현체.
 * 머리(Head)와 몸통(Body) 부위별 피격 판정을 지원합니다.
 */
export class HumanoidTarget extends BaseTarget {
  public id: string;
  public mesh: Mesh;
  public type: string = 'humanoid';
  public isMoving: boolean = false;
  private shadowGenerator: ShadowGenerator;

  constructor(scene: Scene, id: string, position: Vector3, shadowGenerator: ShadowGenerator) {
    // 인간형은 조금 더 높은 체력을 가질 수 있음
    super(scene, 150);
    this.id = id;
    this.shadowGenerator = shadowGenerator;
    this.mesh = this.createHumanoidMesh(position);
  }

  private createHumanoidMesh(position: Vector3): Mesh {
    // 1. 몸통 (Body) - 부모 메쉬
    const body = MeshBuilder.CreateBox(
      `${this.id}_body`,
      { width: 0.6, height: 1.2, depth: 0.3 },
      this.scene
    );
    body.position = position;
    body.isPickable = true;

    const bodyMat = new StandardMaterial(`${this.id}BodyMat`, this.scene);
    bodyMat.diffuseColor = new Color3(0.2, 0.4, 0.8);
    body.material = bodyMat;

    // 2. 머리 (Head)
    const head = MeshBuilder.CreateSphere(`${this.id}_head`, { diameter: 0.4 }, this.scene);
    head.parent = body;
    head.position = new Vector3(0, 0.8, 0); // 몸통 위에 위치
    head.isPickable = true;

    const headMat = new StandardMaterial(`${this.id}HeadMat`, this.scene);
    headMat.diffuseColor = new Color3(0.9, 0.7, 0.6);
    head.material = headMat;

    // 그림자 추가
    this.shadowGenerator.addShadowCaster(body);
    this.shadowGenerator.addShadowCaster(head);

    body.metadata = { targetId: this.id, part: 'body' };
    head.metadata = { targetId: this.id, part: 'head' };

    return body;
  }

  protected onHit(amount: number, _hitPoint?: Vector3): void {
    // 피격 시 몸통 색상을 잠시 붉게 변경
    const bodyMat = this.mesh.material as StandardMaterial;
    if (!bodyMat) return;

    const originalBodyColor = bodyMat.diffuseColor.clone();
    bodyMat.diffuseColor = new Color3(1, 0, 0);

    // 데미지가 크면(헤드샷 등) 머리도 깜빡임
    const head = this.mesh.getChildMeshes().find((m) => m.name.endsWith('head')) as Mesh;
    let originalHeadColor: Color3 | null = null;
    if (head && head.material instanceof StandardMaterial && amount > 100) {
      originalHeadColor = head.material.diffuseColor.clone();
      head.material.diffuseColor = new Color3(1, 1, 0); // 헤드샷은 노란색으로 강조
    }

    setTimeout(() => {
      if (this.mesh && !this.mesh.isDisposed()) {
        bodyMat.diffuseColor = originalBodyColor;
        if (head && originalHeadColor && !head.isDisposed()) {
          (head.material as StandardMaterial).diffuseColor = originalHeadColor;
        }
      }
    }, 100);
  }

  public onDestroy(): void {
    console.log(`[HumanoidTarget] onDestroy called for ${this.id}`);
    this.playDestroyAnimation();
  }

  private playDestroyAnimation(): void {
    if (!this.mesh || this.mesh.isDisposed()) return;

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
      { frame: 20, value: new Vector3(0, 0, 0) },
    ]);

    this.mesh.animations = [scaleAnim];
    this.scene.beginAnimation(this.mesh, 0, 20, false, 1, () => {
      console.log(`[HumanoidTarget] Animation ended, disposing mesh for ${this.id}`);
      this.mesh.dispose();
    });
  }
}
