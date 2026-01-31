import {
  Mesh,
  Vector3,
  Scene,
  StandardMaterial,
  Color3,
  MeshBuilder,
  Skeleton,
  AnimationPropertiesOverride,
  AbstractMesh,
  ShadowGenerator,
} from '@babylonjs/core';
import { BaseComponent, IPawnCore } from '@ante/game-core';
import { AssetLoader } from '../AssetLoader';
import { Logger } from '@ante/common';

const logger = new Logger('EnemyModelLoader');

interface EnemyModelOwner extends IPawnCore {
  mesh: Mesh;
}

/**
 * 적 모델 로딩 및 Hitbox 생성을 담당하는 컴포넌트
 */
export class EnemyModelLoader extends BaseComponent {
  private enemyOwner: EnemyModelOwner;
  private shadowGenerator: ShadowGenerator;

  // Loaded assets
  private visualMesh: AbstractMesh | null = null;
  private placeholderMesh: Mesh | null = null;
  private skeleton: Skeleton | null = null;
  private isLoaded = false;

  constructor(owner: EnemyModelOwner, scene: Scene, shadowGenerator: ShadowGenerator) {
    super(owner, scene);
    this.enemyOwner = owner;
    this.shadowGenerator = shadowGenerator;

    // Create placeholder immediately
    this.createPlaceholder();
  }

  public update(_deltaTime: number): void {
    // No per-frame logic needed
  }

  private createPlaceholder(): void {
    this.placeholderMesh = MeshBuilder.CreateCylinder(
      'enemyPlaceholder',
      { height: 1.8, diameter: 0.5 },
      this.scene
    );
    this.placeholderMesh.position = new Vector3(0, 0, 0);
    this.placeholderMesh.parent = this.enemyOwner.mesh;

    const mat = new StandardMaterial('placeholderMat', this.scene);
    mat.diffuseColor = Color3.Red();
    this.placeholderMesh.material = mat;
  }

  public async loadModel(): Promise<void> {
    try {
      const entries = AssetLoader.getInstance().instantiateMesh('enemy');

      if (!entries) {
        const isReady = AssetLoader.getInstance().ready;
        throw new Error(`Enemy asset not preloaded. Loader status: isReady=${isReady}`);
      }

      this.visualMesh = entries.rootNodes[0] as AbstractMesh;
      if (!this.visualMesh) {
        throw new Error('Failed to find root node in instantiated entries for enemy');
      }
      this.visualMesh.setEnabled(false);

      this.skeleton = entries.skeletons.length > 0 ? entries.skeletons[0] : null;

      // Setup metadata on all meshes
      entries.rootNodes.forEach((node) => {
        if (node instanceof AbstractMesh) {
          node.checkCollisions = false;
          node.metadata = { type: 'enemy', pawn: this.enemyOwner };
          node.isPickable = true;
        }

        node.getChildMeshes().forEach((m) => {
          m.metadata = { type: 'enemy', pawn: this.enemyOwner };
          m.isPickable = true;
          if (this.skeleton && m.skeleton !== this.skeleton) {
            m.skeleton = this.skeleton;
          }
        });
      });

      // Parent to root collider
      this.visualMesh.parent = this.enemyOwner.mesh;
      this.visualMesh.position = new Vector3(0, -1.0, 0);
      this.visualMesh.rotation = Vector3.Zero();

      // Shadow setup
      this.shadowGenerator.addShadowCaster(this.visualMesh, true);

      // Animation setup
      this.setupAnimations();

      // Create head hitbox
      this.createHeadHitbox();

      // Show visual mesh
      this.visualMesh.setEnabled(true);

      // Dispose placeholder
      this.disposePlaceholder();

      this.isLoaded = true;
    } catch (e) {
      logger.error(`Failed to load enemy model: ${e}`);
      this.showFallbackVisual();
    }
  }

  private setupAnimations(): void {
    if (!this.skeleton) return;

    this.skeleton.animationPropertiesOverride = new AnimationPropertiesOverride();
    this.skeleton.animationPropertiesOverride.enableBlending = true;
    this.skeleton.animationPropertiesOverride.blendingSpeed = 0.05;
    this.skeleton.animationPropertiesOverride.loopMode = 1;

    // Create animation ranges if not exist
    const idleRange = this.skeleton.getAnimationRange('YBot_Idle');
    if (!idleRange) {
      this.skeleton.createAnimationRange('YBot_Idle', 0, 89);
      this.skeleton.createAnimationRange('YBot_Walk', 90, 118);
      this.skeleton.createAnimationRange('YBot_Run', 119, 135);
      this.skeleton.createAnimationRange('YBot_LeftStrafeWalk', 136, 163);
      this.skeleton.createAnimationRange('YBot_RightStrafeWalk', 164, 191);
    }

    // Start idle animation
    const range = this.skeleton.getAnimationRange('YBot_Idle');
    if (range) {
      this.scene.beginAnimation(this.skeleton, range.from, range.to, true);
    }
  }

  private createHeadHitbox(): void {
    if (!this.skeleton || !this.visualMesh) return;

    const headBone = this.skeleton.bones.find((b) => b.name.toLowerCase().includes('head'));
    if (!headBone) {
      logger.warn('Head bone not found in skeleton');
      return;
    }

    const headBox = MeshBuilder.CreateBox('headBox', { size: 0.25 }, this.scene);
    const transformNode = headBone.getTransformNode();

    if (transformNode) {
      logger.info('Attaching headBox to TransformNode');
      headBox.parent = transformNode;
      headBox.position = Vector3.Zero();
      headBox.rotation = Vector3.Zero();
    } else {
      logger.info('Attaching headBox using attachToBone');
      try {
        headBox.attachToBone(headBone, this.visualMesh);
      } catch (e) {
        logger.error(`Failed to attach to bone: ${e}`);
      }
    }

    headBox.visibility = 0;
    headBox.isPickable = true;
    headBox.metadata = { type: 'enemy', pawn: this.enemyOwner, bodyPart: 'head' };
  }

  private showFallbackVisual(): void {
    this.enemyOwner.mesh.isVisible = true;
    const mat = new StandardMaterial('errMat', this.scene);
    mat.diffuseColor = Color3.Red();
    this.enemyOwner.mesh.material = mat;
  }

  private disposePlaceholder(): void {
    if (this.placeholderMesh) {
      this.placeholderMesh.dispose();
      this.placeholderMesh = null;
    }
  }

  public getSkeleton(): Skeleton | null {
    return this.skeleton;
  }

  public getVisualMesh(): AbstractMesh | null {
    return this.visualMesh;
  }

  public getIsLoaded(): boolean {
    return this.isLoaded;
  }

  public override dispose(): void {
    this.disposePlaceholder();
    if (this.visualMesh && !this.visualMesh.isDisposed()) {
      this.visualMesh.dispose();
    }
    super.dispose();
  }
}
