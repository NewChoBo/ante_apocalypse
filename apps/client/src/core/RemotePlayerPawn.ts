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
  DynamicTexture,
} from '@babylonjs/core';
import { CharacterPawn, CharacterPawnConfig } from './CharacterPawn';
import { TickManager } from '@ante/game-core';
import { GameAssets } from './GameAssets';
import { Logger } from '@ante/common';

import { NetworkInterpolationComponent } from './components/NetworkInterpolationComponent';
import { MuzzleFlashComponent } from './components/MuzzleFlashComponent';

const logger = new Logger('RemotePlayerPawn');

/**
 * 다른 네트워크 플레이어를 나타내는 Pawn.
 * CharacterPawn 상속 + 네트워크/플레이어 전용 기능
 */
export class RemotePlayerPawn extends CharacterPawn {
  public type = 'remote_player';
  public id: string;
  public playerName: string;

  // Player-specific components
  private interpolation: NetworkInterpolationComponent;
  private muzzleFlash: MuzzleFlashComponent;

  // Visuals
  private _nameLabel: Mesh | null = null;
  private weaponMesh: AbstractMesh | null = null;
  private currentWeaponId: string | null = null;
  private shadowGenerator: ShadowGenerator;

  constructor(
    scene: Scene,
    id: string,
    shadowGenerator: ShadowGenerator,
    tickManager: TickManager,
    name: string = 'Unknown'
  ) {
    const config: CharacterPawnConfig = {
      assetKey: 'enemy', // 현재 enemy 모델 사용
      type: 'player',
      position: new Vector3(0, 0, 0),
      shadowGenerator,
      healthBarStyle: 'player',
      showHealthBar: true,
    };
    super(scene, config, tickManager);

    this.id = id;
    this.playerName = name;
    this.shadowGenerator = shadowGenerator;

    // Override mesh setup for remote player
    this.mesh.name = 'remotePlayerRoot_' + id;
    this.mesh.position.copyFrom(config.position); // Ground level (0.0)
    this.mesh.rotationQuaternion = null;
    this.mesh.metadata = {
      type: 'remote_player',
      pawn: this,
      bodyPart: 'body',
    };

    // Player-specific components
    this.interpolation = new NetworkInterpolationComponent(this);
    this.addComponent(this.interpolation);

    this.muzzleFlash = new MuzzleFlashComponent(this, scene);
    this.addComponent(this.muzzleFlash);

    // Name label
    this.createNameLabel(scene, name);
  }

  private createNameLabel(scene: Scene, name: string): void {
    const plane = MeshBuilder.CreatePlane('nameLabel_' + this.id, { width: 2, height: 0.5 }, scene);
    plane.position.y = 2.3; // Above head level (Ground pivot 0.0 + ~2.3m)
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

  // Network state update
  public updateNetworkState(
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number }
  ): void {
    this.interpolation.updateTarget(position, rotation);
  }

  public override tick(deltaTime: number): void {
    // 1. Update interpolation (this updates this.mesh.position)
    this.interpolation.update(deltaTime);
    this.isMoving = this.interpolation.isMoving;

    // 2. Call super.tick which handles velocity-based animation and component updates
    super.tick(deltaTime);

    // 3. Update extra remote-only features
    this.animationComponent.setHeadPitch(this.interpolation.getTargetPitch());
  }

  public override takeDamage(
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

  public override die(): void {
    if (this.isDead) return;
    this.isDead = true;
    logger.info(`Died.`);

    this.mesh.checkCollisions = false;
    this.mesh.isPickable = false;

    this.animationComponent.stopAnimation();

    // Death animation (tilt backward)
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

  public respawn(position: Vector3): void {
    this.isDead = false;
    this.health = 100;
    this.mesh.position.copyFrom(position);
    this.mesh.rotation.x = 0; // Reset death tilt

    this.mesh.checkCollisions = true;
    this.mesh.isPickable = true;

    this.updateHealth(100);
    this.animationComponent.playAnimation('idle'); // Ensure it's not in death pose
    logger.info(`Respawned.`);
  }

  // Weapon handling
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

      const entries = GameAssets.instantiateModel(assetKey, 'remoteWeapon_' + this.id);
      if (!entries) return;

      this.weaponMesh = entries.rootNodes[0] as AbstractMesh;
      this.weaponMesh.parent = this.mesh;

      const skeleton = this.animationComponent.getSkeleton();
      const handBone = skeleton?.bones.find(
        (b) =>
          b.name.toLowerCase().includes('righthand') || b.name.toLowerCase().includes('right_hand')
      );

      if (handBone) {
        const boneNode = handBone.getTransformNode();
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

  // Fire effect
  public fire(
    weaponId: string,
    muzzleData?: {
      position: { x: number; y: number; z: number };
      direction: { x: number; y: number; z: number };
    }
  ): void {
    logger.debug(`Firing weapon: ${weaponId}`);
    this.muzzleFlash.playFireSound();

    let flashPos: Vector3;

    if (muzzleData) {
      // Use networked muzzle position
      flashPos = new Vector3(muzzleData.position.x, muzzleData.position.y, muzzleData.position.z);
    } else {
      // Fallback to local approximation (Eye level is ~1.5m above ground for effects)
      flashPos = this.mesh.position.clone().add(new Vector3(0, 1.5, 0.5));
      if (this.weaponMesh) {
        const matrix = this.weaponMesh.computeWorldMatrix(true);
        flashPos = Vector3.TransformCoordinates(new Vector3(0, 0.2, 0), matrix);
      }
    }

    this.muzzleFlash.createFlash(flashPos);
  }

  public override dispose(): void {
    super.dispose();
    if (this.weaponMesh) this.weaponMesh.dispose();
    if (this._nameLabel) this._nameLabel.dispose();
  }
}
