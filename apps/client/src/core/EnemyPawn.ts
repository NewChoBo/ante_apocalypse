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
import { BasePawn } from './BasePawn';
import { IEnemyPawn } from '@ante/game-core';
import { AssetLoader } from './AssetLoader';
import { Logger } from '@ante/common';
import { HealthBarComponent } from './components/HealthBarComponent';

const logger = new Logger('EnemyPawn');

export class EnemyPawn extends BasePawn implements IEnemyPawn {
  public mesh: Mesh;
  public isDead = false;
  private _lastPosition: Vector3 = new Vector3();
  public type = 'enemy';

  // Visuals & Animation
  private visualMesh: AbstractMesh | null = null;
  private placeholderMesh: Mesh | null = null;
  private skeleton: Skeleton | null = null;
  private shadowGenerator: ShadowGenerator;
  private healthBarComponent: HealthBarComponent | null = null;

  // Animation Ranges
  private idleRange: any;
  private walkRange: any;
  // private runRange: any;
  // private leftRange: any;
  // private rightRange: any;

  constructor(scene: Scene, position: Vector3, shadowGenerator: ShadowGenerator) {
    super(scene);
    this.shadowGenerator = shadowGenerator;
    this.damageProfile = {
      multipliers: { head: 2.0, body: 1.0 },
      defaultMultiplier: 1.0,
    };

    // 1. Create Root Collider (Invisible Box/Capsule)
    // This allows the Pawn to exist and collide immediately while model loads
    this.mesh = MeshBuilder.CreateBox('enemyRoot', { width: 0.5, height: 2, depth: 0.5 }, scene);
    this.mesh.position.copyFrom(position);
    this.mesh.position.y += 1.0; // Pivot at center, so move up
    this.mesh.checkCollisions = true;
    this.mesh.isVisible = false; // Hide collider

    // Metadata for Raycast/Tagging
    this.mesh.metadata = { type: 'enemy', pawn: this };

    // Health Bar Component
    this.healthBarComponent = new HealthBarComponent(this, scene, {
      style: 'enemy',
      width: 1.0,
      height: 0.15,
      yOffset: 2.0,
    });
    this.addComponent(this.healthBarComponent);

    // 2. Placeholder (prevent pop-in)
    this.placeholderMesh = MeshBuilder.CreateCylinder(
      'enemyPlaceholder',
      { height: 1.8, diameter: 0.5 },
      scene
    );
    this.placeholderMesh.position = new Vector3(0, 0, 0); // Local to parent (0,0,0 is center)
    this.placeholderMesh.parent = this.mesh;
    const pMat = new StandardMaterial('placeholderMat', scene);
    pMat.diffuseColor = Color3.Red();
    this.placeholderMesh.material = pMat;

    // 3. Load Visual Model asynchronously
    this.loadModel();
  }

  private async loadModel(): Promise<void> {
    try {
      // Use consolidated AssetLoader to instantiate preloaded mesh
      const entries = AssetLoader.getInstance().instantiateMesh('enemy');

      if (!entries) {
        const isReady = AssetLoader.getInstance().ready;
        throw new Error(`Enemy asset not preloaded. Loader status: isReady=${isReady}`);
      }

      this.visualMesh = entries.rootNodes[0] as AbstractMesh;
      if (!this.visualMesh) {
        throw new Error(`[EnemyPawn] Failed to find root node in instantiated entries for enemy`);
      }
      this.visualMesh.setEnabled(false); // Hide T-pose initially

      this.skeleton = entries.skeletons.length > 0 ? entries.skeletons[0] : null;

      // ... Skeleton linkage loop ...
      entries.rootNodes.forEach((node) => {
        if (node instanceof AbstractMesh) {
          node.checkCollisions = false;
          node.metadata = { type: 'enemy', pawn: this };
          node.isPickable = true;
        }

        node.getChildMeshes().forEach((m) => {
          m.metadata = { type: 'enemy', pawn: this };
          m.isPickable = true;
          if (this.skeleton && m.skeleton !== this.skeleton) {
            m.skeleton = this.skeleton;
          }
        });
      });

      // Parent to Root Collider
      this.visualMesh.parent = this.mesh;
      this.visualMesh.position = new Vector3(0, -1.0, 0);
      this.visualMesh.rotation = Vector3.Zero();

      // Shadow & Rendering setup
      this.shadowGenerator.addShadowCaster(this.visualMesh, true);

      // Animation Setup
      if (this.skeleton) {
        this.skeleton.animationPropertiesOverride = new AnimationPropertiesOverride();
        this.skeleton.animationPropertiesOverride.enableBlending = true;
        this.skeleton.animationPropertiesOverride.blendingSpeed = 0.05;
        this.skeleton.animationPropertiesOverride.loopMode = 1;

        this.idleRange = this.skeleton.getAnimationRange('YBot_Idle');

        if (!this.idleRange) {
          this.skeleton.createAnimationRange('YBot_Idle', 0, 89);
          this.skeleton.createAnimationRange('YBot_Walk', 90, 118);
          this.skeleton.createAnimationRange('YBot_Run', 119, 135);
          this.skeleton.createAnimationRange('YBot_LeftStrafeWalk', 136, 163);
          this.skeleton.createAnimationRange('YBot_RightStrafeWalk', 164, 191);
          this.idleRange = this.skeleton.getAnimationRange('YBot_Idle');
        }

        this.walkRange = this.skeleton.getAnimationRange('YBot_Walk');
        // this.runRange = this.skeleton.getAnimationRange('YBot_Run');
        // this.leftRange = this.skeleton.getAnimationRange('YBot_LeftStrafeWalk');
        // this.rightRange = this.skeleton.getAnimationRange('YBot_RightStrafeWalk');

        if (this.idleRange) {
          this.scene.beginAnimation(this.skeleton, this.idleRange.from, this.idleRange.to, true);
        }
      }

      // Now that animation is started and skeleton is linked, show the mesh
      this.visualMesh.setEnabled(true);

      // Create Head Hitbox
      if (this.skeleton) {
        const headBone = this.skeleton.bones.find((b) => b.name.toLowerCase().includes('head'));
        if (headBone) {
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

          headBox.visibility = 0; // Invisible but pickable
          headBox.isPickable = true;
          headBox.metadata = { type: 'enemy', pawn: this, bodyPart: 'head' };

          // Removed redundant parenting to visualMesh
        } else {
          logger.warn('Head bone not found in skeleton');
        }
      }

      // Dispose Placeholder
      if (this.placeholderMesh) {
        this.placeholderMesh.dispose();
        this.placeholderMesh = null;
      }
    } catch (e) {
      logger.error(`Failed to load enemy model: ${e}`);
      // Fallback visualization
      this.mesh.isVisible = true;
      const mat = new StandardMaterial('errMat', this.scene);
      mat.diffuseColor = Color3.Red();
      this.mesh.material = mat;
    }
  }

  public initialize(_scene: Scene): void {
    // 필요한 경우 초기화 로직
  }

  private _lastMoveTime: number = 0;

  public tick(deltaTime: number): void {
    // 1. Calculate movement state by displacement with grace period to avoid network stutter
    const currentPos = this.mesh.position;
    const distance = Vector3.Distance(currentPos, this._lastPosition);
    const now = performance.now();

    if (distance > 0.005) {
      this.isMoving = true;
      this._lastMoveTime = now;
    } else if (now - this._lastMoveTime > 200) {
      // 200ms grace period bridges the 100ms (10Hz) network sync gap
      this.isMoving = false;
    }

    this.updateComponents(deltaTime);

    // Apply Gravity
    if (this.mesh) {
      this.mesh.moveWithCollisions(new Vector3(0, -9.81 * deltaTime, 0));
    }

    this._lastPosition.copyFrom(this.mesh.position);
  }

  public takeDamage(
    amount: number,
    _attackerId?: string,
    _part?: string,
    _hitPoint?: Vector3
  ): void {
    if (this.isDead) return;

    this.health -= amount;
    this.healthBarComponent?.updateHealth(this.health);

    // Hit React (Flash)
    if (this.visualMesh) {
      // Traverse children or use skeleton?
      // Simple material flash logic might need complex handling for GLB/BabylonPBR
      // For now skip visual flash or implement later
    } else if (this.mesh.isVisible) {
      // Fallback box flash
      if (this.mesh.material instanceof StandardMaterial) {
        this.mesh.material.emissiveColor = Color3.White();
        setTimeout(() => {
          if (this.mesh.material instanceof StandardMaterial)
            this.mesh.material.emissiveColor = Color3.Black();
        }, 100);
      }
    }

    if (this.health <= 0) {
      this.die();
    }
  }

  public die(): void {
    if (this.isDead) return;
    this.isDead = true;
    logger.info('Died');

    // Item drop is now handled by the authority (server/simulation)

    // 죽었음을 시각적으로 표시 (일단 비활성화)
    // 실제로는 사망 애니메이션을 재생하거나 래그돌을 적용할 수 있음
    this.mesh.setEnabled(false);
  }

  public dispose(): void {
    super.dispose();
    if (this.mesh && !this.mesh.isDisposed()) this.mesh.dispose();
  }

  public get position(): Vector3 {
    return this.mesh.position;
  }

  public isDisposed(): boolean {
    return this.mesh.isDisposed();
  }

  public updateHealthBar(health: number): void {
    this.healthBarComponent?.updateHealth(health);
  }

  public lookAt(targetPoint: Vector3): void {
    this.mesh.lookAt(targetPoint);
  }

  public move(direction: Vector3, speed: number, deltaTime: number): void {
    this.mesh.moveWithCollisions(direction.scale(speed * deltaTime));

    // Animation State Machine
    if (this.skeleton && this.walkRange && this.idleRange) {
      // Simple logic: if moving, Walk. If not, Idle.
      // But 'move' is called every frame if moving.
      // Need to track current state or speed.

      // This is a naive implementation. For better blending, we need state tracking.
      // Assuming 'move' is called only when moving.
      // But tick resets it?

      // Let's just play Walk if speed > 0.1?
      // But move() doesn't set state persistent.
      // For now, let's just make it walk if this method is called frequently.

      // Better: Set a flag 'isMoving' and handle anim in tick().
      this.isMoving = true;
    }
  }

  public isMoving = false;
  private currentAnim = 'idle';

  // Override tick to handle anim reset
  public updateComponents(deltaTime: number): void {
    super.updateComponents(deltaTime);

    if (this.skeleton && this.walkRange && this.idleRange) {
      if (this.isMoving) {
        if (this.currentAnim !== 'walk') {
          this.scene.beginAnimation(this.skeleton, this.walkRange.from, this.walkRange.to, true);
          this.currentAnim = 'walk';
        }
      } else {
        if (this.currentAnim !== 'idle') {
          this.scene.beginAnimation(this.skeleton, this.idleRange.from, this.idleRange.to, true);
          this.currentAnim = 'idle';
        }
      }
    }
  }
}
