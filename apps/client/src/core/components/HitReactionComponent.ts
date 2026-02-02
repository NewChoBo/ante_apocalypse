import { BaseComponent } from '@ante/game-core';
import { TargetPawn } from '../TargetPawn';
import { Scene, Vector3, StandardMaterial, Color3, Animation, AbstractMesh } from '@babylonjs/core';

export class HitReactionComponent extends BaseComponent {
  readonly componentType = 'HitReaction';

  private targetOwner: TargetPawn;

  constructor(owner: TargetPawn, scene: Scene) {
    super(owner, scene);
    this.targetOwner = owner;
  }

  public update(_deltaTime: number): void {}

  public playHitEffect(part?: string): void {
    const visualMesh = this.targetOwner.meshComponent.getVisualMesh();
    if (!visualMesh) return;

    // Visual Mesh 자체의 메테리얼 확인
    this.flashMaterial(visualMesh);

    // Humanoid 등 하위 메쉬가 있는 경우
    visualMesh.getChildMeshes().forEach((child: AbstractMesh) => {
      if (part === 'head' && child.metadata?.bodyPart === 'head') {
        // 헤드샷 별도 강조 (노란색)
        this.flashMaterial(child, new Color3(1, 1, 0));
      } else {
        this.flashMaterial(child);
      }
    });
  }

  private flashMaterial(mesh: AbstractMesh, flashColor: Color3 = new Color3(1, 0, 0)): void {
    if (!(mesh.material instanceof StandardMaterial)) return;

    const mat = mesh.material;
    const originalColor = mat.diffuseColor.clone();

    mat.diffuseColor = flashColor;

    setTimeout(() => {
      if (!mesh.isDisposed() && mat) {
        mat.diffuseColor = originalColor;
      }
    }, 80);
  }

  public playDestroyEffect(onComplete?: () => void): void {
    const visualMesh = this.targetOwner.meshComponent.getVisualMesh();
    if (!visualMesh) {
      onComplete?.();
      return;
    }

    this.scene.stopAnimation(visualMesh);

    const scaleAnim = new Animation(
      'destroyScale',
      'scaling',
      60,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    scaleAnim.setKeys([
      { frame: 0, value: visualMesh.scaling.clone() },
      { frame: 5, value: visualMesh.scaling.scale(1.2) },
      { frame: 20, value: Vector3.Zero() },
    ]);

    visualMesh.animations = [scaleAnim];
    this.scene.beginAnimation(visualMesh, 0, 20, false, 1, onComplete);
  }
}
