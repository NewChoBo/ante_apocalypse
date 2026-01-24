import {
  Mesh,
  Vector3,
  Scene,
  StandardMaterial,
  Color3,
  MeshBuilder,
  SceneLoader,
  Skeleton,
  AnimationPropertiesOverride,
  AbstractMesh,
  ShadowGenerator,
} from '@babylonjs/core';
import { BasePawn } from './BasePawn';
import { PickupManager } from './systems/PickupManager';

export class EnemyPawn extends BasePawn {
  public mesh: Mesh;
  private health = 100;
  public isDead = false;

  // Visuals & Animation
  private visualMesh: AbstractMesh | null = null;
  private skeleton: Skeleton | null = null;
  private shadowGenerator: ShadowGenerator;

  // Animation Ranges
  private idleRange: any;
  private walkRange: any;
  private runRange: any;
  private leftRange: any;
  private rightRange: any;

  constructor(scene: Scene, position: Vector3, shadowGenerator: ShadowGenerator) {
    super(scene);
    this.shadowGenerator = shadowGenerator;

    // 1. Create Root Collider (Invisible Box/Capsule)
    // This allows the Pawn to exist and collide immediately while model loads
    this.mesh = MeshBuilder.CreateBox('enemyRoot', { width: 0.5, height: 2, depth: 0.5 }, scene);
    this.mesh.position.copyFrom(position);
    this.mesh.position.y += 1.0; // Pivot at center, so move up
    this.mesh.checkCollisions = true;
    this.mesh.isVisible = false; // Hide collider

    // Metadata for Raycast/Tagging
    this.mesh.metadata = { type: 'enemy', pawn: this };

    // 2. Load Visual Model asynchronously
    this.loadModel();
  }

  private async loadModel(): Promise<void> {
    try {
      // Load YBot from BabylonJS Assets
      const result = await SceneLoader.ImportMeshAsync(
        '',
        'https://models.babylonjs.com/',
        'dummy3.babylon',
        this.scene
      );

      const skeleton = result.skeletons[0];
      this.skeleton = skeleton;
      this.visualMesh = result.meshes[0];

      // Parent to Root Collider
      // Normalize position (YBot might need offset)
      this.visualMesh.parent = this.mesh;
      this.visualMesh.position = new Vector3(0, -1.0, 0); // Align feet to bottom of collider
      this.visualMesh.rotation = Vector3.Zero();

      // Shadow & Rendering setup
      this.visualMesh.receiveShadows = true; // Root usually receives?
      this.shadowGenerator.addShadowCaster(this.visualMesh, true);
      // User snippet: "newMeshes[index].receiveShadows = false;" for all?
      // But typically we want shadows.
      // Snippet says: shadowGenerator.addShadowCaster(scene.meshes[0], true);
      // We will handle shadows in EnemyManager or Spawn logic if possible,
      // but here we just ensure properties are sane.

      result.meshes.forEach((m) => {
        m.receiveShadows = true;
        m.checkCollisions = false; // visual doesn't collide, root does

        // Critical: Apply Metadata so Weapon Raycast recognizes this as an Enemy
        m.metadata = { type: 'enemy', pawn: this };
        m.isPickable = true;

        // Also add children to shadow caster if needed?
        // addShadowCaster(mesh, includeDescendants=true) already handles it if the loop is redundant.
        // But 'visualMesh' is root.
      });

      // Animation Setup (From Snippet)
      if (skeleton) {
        skeleton.animationPropertiesOverride = new AnimationPropertiesOverride();
        skeleton.animationPropertiesOverride.enableBlending = true;
        skeleton.animationPropertiesOverride.blendingSpeed = 0.05;
        skeleton.animationPropertiesOverride.loopMode = 1;

        this.idleRange = skeleton.getAnimationRange('YBot_Idle');
        this.walkRange = skeleton.getAnimationRange('YBot_Walk');
        this.runRange = skeleton.getAnimationRange('YBot_Run');
        this.leftRange = skeleton.getAnimationRange('YBot_LeftStrafeWalk');
        this.rightRange = skeleton.getAnimationRange('YBot_RightStrafeWalk');

        // Start Idle
        if (this.idleRange) {
          this.scene.beginAnimation(skeleton, this.idleRange.from, this.idleRange.to, true);
        }
      }

      console.log('Enemy Model Loaded');
    } catch (e) {
      console.error('Failed to load enemy model:', e);
      // Fallback visualization already handled by invisible root?
      // Maybe make root visible red box if failed
      this.mesh.isVisible = true;
      const mat = new StandardMaterial('errMat', this.scene);
      mat.diffuseColor = Color3.Red();
      this.mesh.material = mat;
    }
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

  private die(): void {
    this.isDead = true;
    console.log('Enemy Died');
    // 아이템 드롭
    PickupManager.getInstance().spawnRandomPickup(this.position);

    // Play Death? YBot doesn't seem to have Death.
    // Just dispose for now.
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

  private isMoving = false;
  private currentAnim = 'idle';

  // Override tick to handle anim reset
  public updateComponents(deltaTime: number): void {
    super.updateComponents(deltaTime);

    if (this.skeleton) {
      if (this.isMoving) {
        if (this.currentAnim !== 'walk') {
          this.scene.beginAnimation(this.skeleton, this.walkRange.from, this.walkRange.to, true);
          this.currentAnim = 'walk';
        }
        this.isMoving = false; // Reset for next frame
      } else {
        if (this.currentAnim !== 'idle') {
          this.scene.beginAnimation(this.skeleton, this.idleRange.from, this.idleRange.to, true);
          this.currentAnim = 'idle';
        }
      }
    }
  }
}
