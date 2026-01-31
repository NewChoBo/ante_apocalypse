import { Mesh, MeshBuilder, Scene, Vector3, AbstractMesh, Skeleton } from '@babylonjs/core';
import { Logger } from '@ante/common';
import { BasePawn } from '../../simulation/BasePawn.js';
import { IServerAssetLoader } from '../IServerAssetLoader.js';
import { SkeletonAnimationComponent } from '../../simulation/components/SkeletonAnimationComponent.js';
import { MeshUtils } from '../../simulation/utils/MeshUtils.js';
import { BaseWeapon } from '../../combat/BaseWeapon.js';
import { Firearm } from '../../combat/Firearm.js';
import { WeaponRegistry } from '../../weapons/WeaponRegistry.js';

const logger = new Logger('ServerPlayerPawn');

export class ServerPlayerPawn extends BasePawn {
  public override mesh: Mesh;
  public visualMesh: AbstractMesh | null = null;
  public skeleton: Skeleton | null = null;
  public headBox: Mesh | null = null;
  public override type = 'player';

  public weapons: Map<string, BaseWeapon> = new Map();
  public currentWeapon: BaseWeapon | null = null;

  protected animationComponent: SkeletonAnimationComponent;

  constructor(
    id: string,
    scene: Scene,
    position: Vector3,
    private assetLoader: IServerAssetLoader
  ) {
    super(scene);
    this.id = id;

    // 1. Root Collider (Pivot at feet: 0.0m)
    this.mesh = MeshBuilder.CreateBox(
      'serverPlayerRoot_' + id,
      { width: 0.5, height: 2, depth: 0.5 },
      scene
    );
    this.mesh.setPivotPoint(new Vector3(0, -1, 0));
    this.mesh.position.copyFrom(position); // Should be ground level
    this.mesh.checkCollisions = true;
    this.mesh.isPickable = true;
    this.mesh.metadata = { type: 'player', id: this.id, pawn: this };

    logger.info(`Created ServerPlayerPawn for ${id}`);

    // Animation Component
    this.animationComponent = new SkeletonAnimationComponent(this, scene);
    this.addComponent(this.animationComponent);

    // 2. Load Model
    this.loadModel(scene);

    // 3. Init Default Weapon
    this.equipWeapon('Pistol');
  }

  public equipWeapon(weaponId: string): void {
    if (!this.weapons.has(weaponId)) {
      const stats = WeaponRegistry[weaponId];
      if (!stats) {
        logger.error(`Unknown weapon stats for: ${weaponId}`);
        return;
      }

      // Currently assuming all registry items are firearms for simplicity, or check stats
      // We can also infer type from name or add 'type' to WeaponStats
      const weapon = new Firearm(weaponId, this.id, stats);
      this.weapons.set(weaponId, weapon);
    }

    this.currentWeapon = this.weapons.get(weaponId) || null;
    logger.info(`Player ${this.id} equipped ${weaponId}`);
  }

  public fireRequest(): boolean {
    if (!this.currentWeapon) return false;
    return this.currentWeapon.fireLogic();
  }

  public reloadRequest(): void {
    if (!this.currentWeapon) return;
    if (this.currentWeapon instanceof Firearm) {
      this.currentWeapon.reload();
    }
  }

  private async loadModel(scene: Scene): Promise<void> {
    try {
      logger.info(`Loading model via AssetLoader for ${this.id}`);

      const result = await this.assetLoader.loadModel(scene, 'dummy3.babylon');

      logger.info(
        `AssetLoader finished. Meshes: ${result.meshes.length}, Skeletons: ${result.skeletons.length}`
      );

      this.visualMesh = result.meshes[0]; // Assuming root is 0, or we check common parent
      // In RemotePlayerPawn: entries.rootNodes[0]
      // ImportMeshAsync returns all meshes. dummy3 usually has a __root__ node.
      if (!this.visualMesh) {
        logger.error(`No visual mesh found in loaded model!`);
        return;
      }
      logger.info(`Visual Root Name: ${this.visualMesh.name}`);

      this.visualMesh.parent = this.mesh;

      // Pivot is now at ground level (0,0,0)
      this.visualMesh.position = Vector3.Zero();
      this.visualMesh.rotation = Vector3.Zero();
      this.visualMesh.scaling.set(1, 1, 1);

      // Force update world matrix to prevent ghosting or floating issues
      this.visualMesh.computeWorldMatrix(true);

      this.skeleton = result.skeletons.length > 0 ? result.skeletons[0] : null;

      // Setup Metrics/Metadata for Raycast
      result.meshes.forEach((m) => {
        m.isPickable = true;
        m.metadata = { type: 'player', id: this.id, bodyPart: 'body', pawn: this };
        if (this.skeleton) m.skeleton = this.skeleton;
      });

      // 3. Head Hitbox (Critical for Headshots)
      if (this.skeleton) {
        // Initialize shared animation component
        this.animationComponent.initializeSkeleton(this.skeleton);

        this.headBox = MeshUtils.createHeadHitbox(scene, this.skeleton, this.visualMesh, {
          id: this.id,
          type: 'player',
          pawn: this,
        });
      }

      logger.info(`Model loaded successfully for ${this.id}`);
    } catch (e) {
      logger.error(`Failed to load model for ${this.id}:`, e);
    }
  }

  public tick(deltaTime: number): void {
    // 1. Weapon Logic (Reload timers, etc)
    if (this.currentWeapon) {
      this.currentWeapon.tick(deltaTime);
    }

    // 2. Component Logic (Animation, etc)
    this.updateComponents(deltaTime);
  }

  protected onDeath(): void {
    logger.info(`ServerPlayerPawn ${this.id} died.`);
  }

  public override dispose() {
    super.dispose();
  }
}
