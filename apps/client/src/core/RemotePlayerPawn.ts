import {
  Mesh,
  Scene,
  Vector3,
  StandardMaterial,
  Color3,
  MeshBuilder,
  AbstractMesh,
  ShadowGenerator,
  Animation,
} from '@babylonjs/core';
import { BasePawn } from './BasePawn';
import { AssetLoader } from './AssetLoader';
import { DynamicTexture } from '@babylonjs/core';
import { Logger } from '@ante/common';
import { HealthBarComponent } from './components/HealthBarComponent';
import { NetworkInterpolationComponent } from './components/NetworkInterpolationComponent';
import { SkeletonAnimationComponent } from './components/SkeletonAnimationComponent';
import { MuzzleFlashComponent } from './components/MuzzleFlashComponent';

const logger = new Logger('RemotePlayerPawn');

/**
 * 다른 네트워크 플레이어를 나타내는 Pawn.
 * 컴포넌트 기반으로 리팩토링됨.
 */
export class RemotePlayerPawn extends BasePawn {
  public mesh: Mesh;
  public id: string;
  public playerName: string;
  public type = 'remote_player';
  public isMoving = false;

  // Components
  private interpolation: NetworkInterpolationComponent;
  private animation: SkeletonAnimationComponent;
  private muzzleFlash: MuzzleFlashComponent;
  private healthBarComponent: HealthBarComponent;

  // Visuals
  private visualMesh: AbstractMesh | null = null;
  private _nameLabel: Mesh | null = null;
  private shadowGenerator: ShadowGenerator;
  private weaponMesh: AbstractMesh | null = null;
  private currentWeaponId: string | null = null;

  constructor(
    scene: Scene,
    id: string,
    shadowGenerator: ShadowGenerator,
    name: string = 'Unknown'
  ) {
    super(scene);
    this.id = id;
    this.playerName = name;
    this.shadowGenerator = shadowGenerator;
    this.damageProfile = {
      multipliers: { head: 2.0, body: 1.0 },
      defaultMultiplier: 1.0,
    };

    // Root Collider (Pivot at eye level: 1.75m)
    this.mesh = MeshBuilder.CreateBox('remotePlayerRoot_' + id, { size: 0.1 }, scene);
    this.mesh.position.set(0, 1.75, 0);
    this.mesh.isVisible = false;
    this.mesh.checkCollisions = true;
    this.mesh.rotationQuaternion = null;
    this.mesh.isPickable = true;
    this.mesh.metadata = {
      type: 'remote_player',
      pawn: this,
      bodyPart: 'body',
    };

    // Initialize Components
    this.interpolation = new NetworkInterpolationComponent(this);
    this.addComponent(this.interpolation);

    this.animation = new SkeletonAnimationComponent(this, scene);
    this.addComponent(this.animation);

    this.muzzleFlash = new MuzzleFlashComponent(this, scene);
    this.addComponent(this.muzzleFlash);

    this.healthBarComponent = new HealthBarComponent(this, scene, {
      style: 'player',
      width: 1.5,
      height: 0.2,
      yOffset: 0.8,
    });
    this.addComponent(this.healthBarComponent);

    // Visuals
    this.createNameLabel(scene, name);
    this.loadModel();
  }

  private createNameLabel(scene: Scene, name: string): void {
    const plane = MeshBuilder.CreatePlane('nameLabel_' + this.id, { width: 2, height: 0.5 }, scene);
    plane.position.y = 0.4;
    plane.parent = this.mesh;
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;

    const texture = new DynamicTexture(
      'nameTex_' + this.id,
      { width: 512, height: 128 },
      scene,
      true
    );
    texture.hasAlpha = true;
    texture.drawText(name, null, null, 'bold 70px Rajdhani', 'white', 'transparent', true);

    const mat = new StandardMaterial('nameMat_' + this.id, scene);
    mat.diffuseTexture = texture;
    mat.specularColor = new Color3(0, 0, 0);
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.backFaceCulling = false;
    plane.material = mat;
    this._nameLabel = plane;
  }

  public initialize(): void {}

  private async loadModel(): Promise<void> {
    try {
      const entries = AssetLoader.getInstance().instantiateMesh('enemy', 'remoteVisual_' + this.id);
      if (!entries) return;

      this.visualMesh = entries.rootNodes[0] as AbstractMesh;
      this.visualMesh.parent = this.mesh;
      this.visualMesh.position = new Vector3(0, -1.75, 0);
      this.visualMesh.rotation = Vector3.Zero();
      this.visualMesh.scaling.set(1, 1, 1);

      const skeleton = entries.skeletons.length > 0 ? entries.skeletons[0] : null;
      if (skeleton) {
        this.animation.initializeSkeleton(skeleton);
      }

      // Set up pickable meshes
      entries.rootNodes.forEach((node) => {
        if (node instanceof AbstractMesh) {
          node.isPickable = true;
          node.metadata = { type: 'remote_player', pawn: this, bodyPart: 'body' };
        }
        node.getChildMeshes().forEach((m) => {
          m.isPickable = true;
          m.metadata = { type: 'remote_player', pawn: this, bodyPart: 'body' };
          if (skeleton) m.skeleton = skeleton;
        });
      });

      this.shadowGenerator.addShadowCaster(this.visualMesh, true);

      // Add Head Hitbox
      if (skeleton) {
        const headBone = skeleton.bones.find((b) => b.name.toLowerCase().includes('head'));
        if (headBone) {
          const headBox = MeshBuilder.CreateBox('headBox_' + this.id, { size: 0.25 }, this.scene);
          const transformNode = headBone.getTransformNode();
          if (transformNode) {
            headBox.parent = transformNode;
            headBox.position = Vector3.Zero();
          } else {
            headBox.attachToBone(headBone, this.visualMesh!);
          }
          headBox.visibility = 0;
          headBox.isPickable = true;
          headBox.metadata = { type: 'remote_player', pawn: this, bodyPart: 'head' };
        }
      }
    } catch (e) {
      logger.error(`Failed to load remote player model: ${e}`);
    }
  }

  public updateWeapon(_weaponId: string): void {
    const assetKey = 'rifle';
    if (this.currentWeaponId === assetKey) return;
    this.currentWeaponId = assetKey;
    this.loadWeaponModel(assetKey);
  }

  private async loadWeaponModel(assetKey: string): Promise<void> {
    try {
      if (this.weaponMesh) {
        this.weaponMesh.dispose();
        this.weaponMesh = null;
      }

      const entries = AssetLoader.getInstance().instantiateMesh(
        assetKey,
        'remoteWeapon_' + this.id
      );
      if (!entries) return;

      this.weaponMesh = entries.rootNodes[0] as AbstractMesh;
      this.weaponMesh.parent = this.mesh;

      const skeleton = this.animation.getSkeleton();
      const handBone = skeleton?.bones.find(
        (b) =>
          b.name.toLowerCase().includes('righthand') || b.name.toLowerCase().includes('right_hand')
      );

      if (handBone) {
        const boneNode = (handBone as any).getTransformNode();
        if (boneNode) {
          this.weaponMesh.parent = boneNode;
          this.weaponMesh.position = new Vector3(0, 0, 0);
          this.weaponMesh.rotation = new Vector3(Math.PI / 2, 0, 0);
        }
      } else {
        this.weaponMesh.position = new Vector3(0.3, -0.5, 0.5);
      }

      this.shadowGenerator.addShadowCaster(this.weaponMesh, true);
    } catch (e) {
      logger.error(`Failed to load remote weapon model: ${e}`);
    }
  }

  public updateNetworkState(
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number }
  ): void {
    this.interpolation.updateTarget(position, rotation);
  }

  public tick(deltaTime: number): void {
    // Update interpolation
    this.interpolation.update(deltaTime);
    this.isMoving = this.interpolation.isMoving;

    // Update head pitch
    this.animation.setHeadPitch(this.interpolation.getTargetPitch());

    // Update animations based on movement
    this.animation.updateByMovementState(this.isMoving);

    // Update all other components
    this.updateComponents(deltaTime);
  }

  public takeDamage(
    amount: number,
    _attackerId?: string,
    _part?: string,
    _hitPoint?: Vector3
  ): void {
    if (this.isDead) return;
    logger.info(`Hit for ${amount} damage.`);
    this.healthBarComponent?.updateHealth(this.health - amount);
  }

  public updateHealth(health: number): void {
    this.health = health;
    this.healthBarComponent?.updateHealth(health);
  }

  public die(): void {
    if (this.isDead) return;
    this.isDead = true;
    logger.info(`Died.`);

    this.mesh.checkCollisions = false;
    this.mesh.isPickable = false;

    this.animation.stopAnimation();

    // Death animation
    const deathAnim = new Animation(
      'deathAnim',
      'rotation.x',
      30,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    deathAnim.setKeys([
      { frame: 0, value: this.mesh.rotation.x },
      { frame: 30, value: this.mesh.rotation.x - Math.PI / 2 },
    ]);
    this.mesh.animations.push(deathAnim);
    this.scene.beginAnimation(this.mesh, 0, 30, false);
  }

  public fire(
    _weaponId: string,
    _muzzleData?: {
      position: { x: number; y: number; z: number };
      direction: { x: number; y: number; z: number };
    }
  ): void {
    this.muzzleFlash.playFireSound();

    // Calculate flash position
    let flashPos = this.mesh.position.clone().add(new Vector3(0, 1.5, 0.5));
    if (this.weaponMesh) {
      const matrix = this.weaponMesh.computeWorldMatrix(true);
      flashPos = Vector3.TransformCoordinates(new Vector3(0, 0.2, 0), matrix);
    }

    this.muzzleFlash.createFlash(flashPos);
  }

  public dispose(): void {
    super.dispose();
    if (this.weaponMesh) this.weaponMesh.dispose();
    if (this._nameLabel) this._nameLabel.dispose();
  }
}
