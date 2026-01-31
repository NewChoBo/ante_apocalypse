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

const logger = new Logger('CharacterModelLoader');

export interface CharacterModelLoaderConfig {
  assetKey: string;
  shadowGenerator: ShadowGenerator;
  entityType: 'player' | 'enemy';
}

interface CharacterModelOwner extends IPawnCore {
  mesh: Mesh;
}

/**
 * 캐릭터 모델 로딩을 담당하는 통합 컴포넌트
 * player/enemy 모두 사용 가능
 */
export class CharacterModelLoader extends BaseComponent {
  private charOwner: CharacterModelOwner;
  private config: CharacterModelLoaderConfig;

  // Loaded assets
  private visualMesh: AbstractMesh | null = null;
  private placeholderMesh: Mesh | null = null;
  private skeleton: Skeleton | null = null;
  private isLoaded = false;

  constructor(owner: CharacterModelOwner, scene: Scene, config: CharacterModelLoaderConfig) {
    super(owner, scene);
    this.charOwner = owner;
    this.config = config;

    // Create placeholder immediately
    this.createPlaceholder();
  }

  public update(_deltaTime: number): void {
    // No per-frame logic needed
  }

  private createPlaceholder(): void {
    const color = this.config.entityType === 'enemy' ? Color3.Red() : Color3.Blue();

    this.placeholderMesh = MeshBuilder.CreateCylinder(
      `${this.config.entityType}Placeholder`,
      { height: 1.8, diameter: 0.5 },
      this.scene
    );
    this.placeholderMesh.position = new Vector3(0, 0, 0);
    this.placeholderMesh.parent = this.charOwner.mesh;

    const mat = new StandardMaterial('placeholderMat', this.scene);
    mat.diffuseColor = color;
    this.placeholderMesh.material = mat;
  }

  public async loadModel(): Promise<void> {
    try {
      const entries = AssetLoader.getInstance().instantiateMesh(this.config.assetKey);

      if (!entries) {
        const isReady = AssetLoader.getInstance().ready;
        throw new Error(
          `${this.config.assetKey} asset not preloaded. Loader status: isReady=${isReady}`
        );
      }

      this.visualMesh = entries.rootNodes[0] as AbstractMesh;
      if (!this.visualMesh) {
        throw new Error(
          `Failed to find root node in instantiated entries for ${this.config.assetKey}`
        );
      }
      this.visualMesh.setEnabled(false);

      this.skeleton = entries.skeletons.length > 0 ? entries.skeletons[0] : null;

      // Setup metadata on all meshes
      entries.rootNodes.forEach((node) => {
        if (node instanceof AbstractMesh) {
          node.checkCollisions = false;
          node.metadata = { type: this.config.entityType, pawn: this.charOwner };
          node.isPickable = true;
        }

        node.getChildMeshes().forEach((m) => {
          m.metadata = { type: this.config.entityType, pawn: this.charOwner };
          m.isPickable = true;
          if (this.skeleton && m.skeleton !== this.skeleton) {
            m.skeleton = this.skeleton;
          }
        });
      });

      // Parent to root collider
      this.visualMesh.parent = this.charOwner.mesh;
      this.visualMesh.position = new Vector3(0, -1.0, 0);
      this.visualMesh.rotation = Vector3.Zero();

      // Shadow setup
      this.config.shadowGenerator.addShadowCaster(this.visualMesh, true);

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
      logger.error(`Failed to load ${this.config.assetKey} model: ${e}`);
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
      headBox.parent = transformNode;
      headBox.position = Vector3.Zero();
      headBox.rotation = Vector3.Zero();
    } else {
      try {
        headBox.attachToBone(headBone, this.visualMesh);
      } catch (e) {
        logger.error(`Failed to attach to bone: ${e}`);
      }
    }

    headBox.visibility = 0;
    headBox.isPickable = true;
    headBox.metadata = { type: this.config.entityType, pawn: this.charOwner, bodyPart: 'head' };
  }

  private showFallbackVisual(): void {
    const color = this.config.entityType === 'enemy' ? Color3.Red() : Color3.Blue();
    this.charOwner.mesh.isVisible = true;
    const mat = new StandardMaterial('errMat', this.scene);
    mat.diffuseColor = color;
    this.charOwner.mesh.material = mat;
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
