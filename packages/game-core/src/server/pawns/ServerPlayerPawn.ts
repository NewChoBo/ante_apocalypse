import { Mesh, MeshBuilder, Vector3, AbstractMesh, Skeleton } from '@babylonjs/core';
import { Logger } from '@ante/common';
import { BasePawn } from '../../simulation/BasePawn.js';
import { IServerAssetLoader } from '../IServerAssetLoader.js';
import { ServerGameContext } from '../../types/ServerGameContext.js';
import { SkeletonAnimationComponent } from '../../simulation/components/SkeletonAnimationComponent.js';
import { MeshUtils } from '../../simulation/utils/MeshUtils.js';
import { BaseWeapon } from '../../combat/BaseWeapon.js';
import { Firearm } from '../../combat/Firearm.js';
import { WeaponRegistry } from '../../weapons/WeaponRegistry.js';

const logger = new Logger('ServerPlayerPawn');

/**
 * 서버측 플레이어 Pawn 객체.
 */
export class ServerPlayerPawn extends BasePawn {
  public override mesh: Mesh;
  public visualMesh: AbstractMesh | null = null;
  public skeleton: Skeleton | null = null;
  public headBox: Mesh | null = null;
  public override type = 'player';
  public name: string = 'Unknown';

  public weapons: Map<string, BaseWeapon> = new Map();
  public currentWeapon: BaseWeapon | null = null;

  protected animationComponent: SkeletonAnimationComponent;

  constructor(
    id: string,
    private ctx: ServerGameContext,
    position: Vector3,
    private assetLoader: IServerAssetLoader
  ) {
    super(ctx.scene, ctx.tickManager);
    this.id = id;

    // 1. Root Collider (Pivot at feet: 0.0m)
    this.mesh = MeshBuilder.CreateBox(
      'serverPlayerRoot_' + id,
      { width: 0.5, height: 2, depth: 0.5 },
      this.ctx.scene
    );
    this.mesh.setPivotPoint(new Vector3(0, -1, 0));
    this.mesh.position.copyFrom(position);
    this.mesh.checkCollisions = true;
    this.mesh.isPickable = false;
    this.mesh.metadata = { type: 'player', id: this.id, pawn: this };
    this.damageProfile = {
      multipliers: { head: 2.0, body: 1.0 },
      defaultMultiplier: 1.0,
    };

    logger.info(`Created ServerPlayerPawn for ${id}`);

    // Animation Component
    this.animationComponent = new SkeletonAnimationComponent(this, this.ctx.scene);
    this.addComponent(this.animationComponent);

    // 2. Load Model
    this.loadModel();

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

      const weapon = new Firearm(weaponId, this.id, stats);
      weapon.reserveAmmo = 999;
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

  private async loadModel(): Promise<void> {
    try {
      logger.info(`Loading model via AssetLoader for ${this.id}`);

      const result = await this.assetLoader.loadModel(this.ctx.scene, 'dummy3.babylon');

      logger.info(
        `AssetLoader finished. Meshes: ${result.meshes.length}, Skeletons: ${result.skeletons.length}`
      );

      this.visualMesh = result.meshes[0];
      if (!this.visualMesh) {
        logger.error(`No visual mesh found in loaded model!`);
        return;
      }

      this.visualMesh.parent = this.mesh;
      this.visualMesh.position = Vector3.Zero();
      this.visualMesh.rotation = Vector3.Zero();
      this.visualMesh.scaling.set(1, 1, 1);
      this.visualMesh.computeWorldMatrix(true);

      this.skeleton = result.skeletons.length > 0 ? result.skeletons[0] : null;

      result.meshes.forEach((m) => {
        m.isPickable = true;
        m.metadata = { type: 'player', id: this.id, bodyPart: 'body', pawn: this };
        if (this.skeleton) m.skeleton = this.skeleton;
      });

      if (this.skeleton) {
        this.animationComponent.initializeSkeleton(this.skeleton);
        this.headBox = MeshUtils.createHeadHitbox(this.ctx.scene, this.skeleton, this.visualMesh, {
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
    if (this.currentWeapon) {
      this.currentWeapon.tick(deltaTime);
    }
    this.updateComponents(deltaTime);
  }

  protected onDeath(): void {
    logger.info(`ServerPlayerPawn ${this.id} died.`);
  }

  public override dispose(): void {
    super.dispose();
  }
}
