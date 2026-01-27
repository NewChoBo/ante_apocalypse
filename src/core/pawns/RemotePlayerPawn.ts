import {
  Mesh,
  Scene,
  Vector3,
  StandardMaterial,
  Color3,
  MeshBuilder,
  DynamicTexture,
  AbstractMesh,
  Skeleton,
  AnimationPropertiesOverride,
  ShadowGenerator,
  Animation,
  AnimationRange,
  TransformNode,
  Node,
} from '@babylonjs/core';
import { WeaponUtils } from '../../utils/WeaponUtils';
import { BasePawn } from './BasePawn';
import { AssetLoader, GameAssets } from '../loaders/AssetLoader';
import { ParticleSystem, Texture } from '@babylonjs/core';

/**
 * 다른 네트워크 플레이어를 나타내는 Pawn.
 */
export class RemotePlayerPawn extends BasePawn {
  public mesh: Mesh;
  private targetPosition: Vector3;
  private targetRotation: Vector3;
  private snapshots: { timestamp: number; position: Vector3; rotation: Vector3 }[] = [];
  private readonly INTERPOLATION_DELAY = 100; // ms
  private lerpSpeed = 10;
  public id: string;
  public playerName: string;
  private _nameLabel: Mesh | null = null;
  private _healthBar: Mesh | null = null;
  private _healthBarTexture: DynamicTexture | null = null;
  public type = 'remote_player';
  public isMoving = false;

  // Visuals & Animation
  private visualMesh: AbstractMesh | null = null;
  private skeleton: Skeleton | null = null;
  private headBoneNode: TransformNode | null = null;
  private shadowGenerator: ShadowGenerator;
  private weaponMesh: AbstractMesh | null = null;
  private currentWeaponId: string | null = null;

  // Animation Ranges
  private idleRange: AnimationRange | null = null;
  private walkRange: AnimationRange | null = null;
  private currentAnim = 'idle';

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

    // 1. Root Collider (Pivot at eye level: 1.75m)
    this.mesh = MeshBuilder.CreateBox('remotePlayerRoot_' + id, { size: 0.1 }, scene);
    this.mesh.position.set(0, 1.75, 0);
    this.mesh.isVisible = false;
    this.mesh.checkCollisions = true;

    // Euler rotation synchronization
    this.mesh.rotationQuaternion = null;

    this.createNameLabel(scene, name);
    this.createHealthBar(scene);

    this.mesh.isPickable = true;
    this.mesh.metadata = {
      type: 'remote_player',
      pawn: this,
      bodyPart: 'body',
    };

    this.targetPosition = this.mesh.position.clone();
    this.targetRotation = new Vector3(0, 0, 0);

    // 2. Load Model
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
    console.log(`[RemotePlayer] Created name label for ${name}`);
  }

  private createHealthBar(scene: Scene): void {
    const plane = MeshBuilder.CreatePlane(
      'healthBar_' + this.id,
      { width: 1.5, height: 0.2 },
      scene
    );
    plane.position.y = 0.8; // Above name label
    plane.parent = this.mesh;
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;

    const texture = new DynamicTexture(
      'healthTex_' + this.id,
      { width: 300, height: 40 },
      scene,
      true
    );
    texture.hasAlpha = true;
    this._healthBarTexture = texture;
    this.updateHealthBar(100);

    const mat = new StandardMaterial('healthMat_' + this.id, scene);
    mat.diffuseTexture = texture;
    mat.emissiveColor = Color3.White();
    mat.backFaceCulling = false;
    plane.material = mat;
    this._healthBar = plane;
  }

  private updateHealthBar(health: number): void {
    if (!this._healthBarTexture) return;
    const ctx = this._healthBarTexture.getContext();
    const width = 300;
    const height = 40;
    const healthPct = Math.max(0, health) / 100;

    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, width, height);

    // Health
    ctx.fillStyle = healthPct > 0.5 ? '#00ff00' : healthPct > 0.2 ? '#ffff00' : '#ff0000';
    ctx.fillRect(2, 2, (width - 4) * healthPct, height - 4);

    this._healthBarTexture.update();
  }

  public initialize(): void {}

  public setupInput(_enabled: boolean): void {
    // Remote players do not have local input components
  }

  private async loadModel(): Promise<void> {
    try {
      const entries = AssetLoader.getInstance().instantiateMesh('enemy', 'remoteVisual_' + this.id);
      if (!entries) return;

      this.visualMesh = entries.rootNodes[0] as AbstractMesh;
      this.visualMesh.parent = this.mesh;

      // Pivot is at eye level (1.75m), visual model feet at -1.75m
      this.visualMesh.position = new Vector3(0, -1.75, 0);
      this.visualMesh.rotation = Vector3.Zero();

      // Scaling to match player height if YBot is slightly different
      // Assuming original YBot is roughly 1.8-1.9m, 1.0 scale is usually fine for 1.75m eye level
      this.visualMesh.scaling.set(1, 1, 1);

      this.skeleton = entries.skeletons.length > 0 ? entries.skeletons[0] : null;

      if (this.skeleton) {
        // Try to find head or neck for pitch rotation
        const headBone =
          this.skeleton.bones.find((b) => b.name.toLowerCase().includes('head')) ||
          this.skeleton.bones.find((b) => b.name.toLowerCase().includes('neck'));
        this.headBoneNode = headBone ? headBone.getTransformNode() : null;
      }

      entries.rootNodes.forEach((node) => {
        if (node instanceof AbstractMesh) {
          node.isPickable = true;
          node.metadata = { type: 'enemy', pawn: this, bodyPart: 'body' };
        }
        node.getChildMeshes().forEach((m) => {
          m.isPickable = true;
          m.metadata = { type: 'remote_player', pawn: this, bodyPart: 'body' };
          if (this.skeleton) m.skeleton = this.skeleton;
        });
      });

      this.shadowGenerator.addShadowCaster(this.visualMesh, true);

      // Animation Setup
      if (this.skeleton) {
        this.skeleton.animationPropertiesOverride = new AnimationPropertiesOverride();
        this.skeleton.animationPropertiesOverride.enableBlending = true;
        this.skeleton.animationPropertiesOverride.blendingSpeed = 0.1;

        this.idleRange = this.skeleton.getAnimationRange('YBot_Idle');
        if (!this.idleRange) {
          this.skeleton.createAnimationRange('YBot_Idle', 0, 89);
          this.skeleton.createAnimationRange('YBot_Walk', 90, 118);
          this.idleRange = this.skeleton.getAnimationRange('YBot_Idle');
        }
        this.walkRange = this.skeleton.getAnimationRange('YBot_Walk');

        if (this.idleRange) {
          this.scene.beginAnimation(this.skeleton, this.idleRange.from, this.idleRange.to, true);
        }
      }
    } catch (e) {
      console.error('Failed to load remote player model:', e);
    }
  }

  public updateWeapon(_weaponId: string): void {
    // Map weaponId to asset key (currently only 'rifle' is available)
    const assetKey = 'rifle';
    if (this.currentWeaponId === assetKey) return;
    this.currentWeaponId = assetKey;
    this.loadWeaponModel(assetKey);
  }

  private async loadWeaponModel(assetKey: keyof GameAssets): Promise<void> {
    try {
      if (this.weaponMesh) {
        this.weaponMesh.dispose();
        this.weaponMesh = null;
      }

      // Determine parent (Hand Bone or Root)
      let parent: Node | undefined = this.mesh;
      let position = new Vector3(0.3, -0.5, 0.5);
      let rotation = Vector3.Zero();

      const handBone = this.skeleton?.bones.find(
        (b) =>
          b.name.toLowerCase().includes('righthand') || b.name.toLowerCase().includes('right_hand')
      );

      if (handBone) {
        const boneNode = handBone.getTransformNode();
        if (boneNode) {
          parent = boneNode;
          position = new Vector3(0, 0, 0);
          rotation = new Vector3(Math.PI / 2, 0, 0);
        }
      }

      const mesh = await WeaponUtils.createWeaponMesh(this.scene, {
        assetName: assetKey,
        targetSize: 0.6, // Default Rifle size for TPS? (Rifle in FPS is 0.6)
        parent,
        position,
        rotation,
        scalingZMultiplier: 1.6, // Match Rifle.ts scale
        isPickable: true,
        receiveShadows: true,
      });

      if (mesh) {
        this.weaponMesh = mesh;
        this.weaponMesh.name = 'remoteWeapon_' + this.id;

        // Ensure metadata for picking
        this.weaponMesh.getChildMeshes().forEach((m) => {
          m.metadata = { type: 'remote_player', pawn: this, bodyPart: 'weapon' };
        });

        this.shadowGenerator.addShadowCaster(this.weaponMesh, true);
      }
    } catch (e) {
      console.error('Failed to load remote weapon model:', e);
    }
  }

  public updateNetworkState(
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number }
  ): void {
    const now = performance.now();
    this.snapshots.push({
      timestamp: now,
      position: new Vector3(position.x, position.y, position.z),
      rotation: new Vector3(rotation.x, rotation.y, rotation.z),
    });

    // Keep buffer small
    if (this.snapshots.length > 20) {
      this.snapshots.shift();
    }

    this.targetPosition.set(position.x, position.y, position.z);
    this.targetRotation.set(rotation.x, rotation.y, rotation.z);
  }

  public tick(deltaTime: number): void {
    // 1. Calculate movement state
    const renderTime = performance.now() - this.INTERPOLATION_DELAY;

    if (this.snapshots.length >= 2) {
      // Find two snapshots to interpolate between
      let i = 0;
      for (i = 0; i < this.snapshots.length - 1; i++) {
        if (this.snapshots[i + 1].timestamp > renderTime) break;
      }

      const s0 = this.snapshots[i];
      const s1 = this.snapshots[i + i < this.snapshots.length - 1 ? 1 : 0];

      if (s1 && s1.timestamp > renderTime) {
        const t = (renderTime - s0.timestamp) / (s1.timestamp - s0.timestamp);
        this.mesh.position = Vector3.Lerp(s0.position, s1.position, t);

        // Yaw Interpolation
        let diffYaw = s1.rotation.y - s0.rotation.y;
        while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
        while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
        this.mesh.rotation.y = s0.rotation.y + diffYaw * t;

        if (this.headBoneNode) {
          this.headBoneNode.rotation.x = s0.rotation.x + (s1.rotation.x - s0.rotation.x) * t;
        }

        const posDiff = Vector3.Distance(s0.position, s1.position);
        this.isMoving = posDiff > 0.01;
      } else {
        // Fallback to simple lerp if no future snapshot
        this.mesh.position = Vector3.Lerp(
          this.mesh.position,
          this.targetPosition,
          Math.min(1.0, deltaTime * this.lerpSpeed)
        );
        this.isMoving = Vector3.Distance(this.mesh.position, this.targetPosition) > 0.02;
      }

      // Cleanup old snapshots
      if (i > 0) {
        this.snapshots.splice(0, i);
      }
    } else {
      // Fallback
      this.mesh.position = Vector3.Lerp(
        this.mesh.position,
        this.targetPosition,
        Math.min(1.0, deltaTime * this.lerpSpeed)
      );
      this.isMoving = Vector3.Distance(this.mesh.position, this.targetPosition) > 0.02;
    }

    // 4. Update Animations (keep the existing logic)
    if (this.skeleton) {
      if (this.isMoving) {
        if (this.currentAnim !== 'walk' && this.walkRange) {
          this.scene.beginAnimation(this.skeleton, this.walkRange.from, this.walkRange.to, true);
          this.currentAnim = 'walk';
        }
      } else {
        if (this.currentAnim !== 'idle' && this.idleRange) {
          this.scene.beginAnimation(this.skeleton, this.idleRange.from, this.idleRange.to, true);
          this.currentAnim = 'idle';
        }
      }
    }

    this.updateComponents(deltaTime);
  }

  public takeDamage(
    amount: number,
    _attackerId?: string,
    _part?: string,
    _hitPoint?: Vector3
  ): void {
    if (this.isDead) return;
    console.log(`Remote player ${this.id} hit for ${amount} damage.`);
    // Note: Actual health sync comes from NetworkManager/MultiplayerSystem updates
    // But if we want local prediction or visual feedback:
    this.updateHealthBar(this.health - amount); // Prediction
  }

  public updateHealth(health: number): void {
    this.health = health;
    this.updateHealthBar(health);
  }

  public die(): void {
    if (this.isDead) return;
    this.isDead = true;
    console.log(`Remote player ${this.id} died.`);

    // Disable collider
    this.mesh.checkCollisions = false;
    this.mesh.isPickable = false;

    // Simple visual death: Fall backward
    if (this.skeleton) {
      this.scene.stopAnimation(this.skeleton);
    }

    // Play death animation (rotation)
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
    this.mesh.animations = []; // Clear previous
    this.mesh.animations.push(deathAnim);
    this.scene.beginAnimation(this.mesh, 0, 30, false, 1);
  }

  public respawn(position: Vector3): void {
    this.isDead = false;
    this.health = 100; // Reset visual health
    this.updateHealthBar(100);

    this.mesh.position.copyFrom(position);
    this.mesh.rotation.x = 0; // Reset death rotation
    this.mesh.checkCollisions = true;
    this.mesh.isPickable = true;

    // Reset animations
    this.mesh.animations = [];
    if (this.skeleton) {
      this.scene.stopAnimation(this.skeleton);
      if (this.idleRange) {
        this.scene.beginAnimation(this.skeleton, this.idleRange.from, this.idleRange.to, true);
      }
    }

    console.log(`[RemotePlayer] ${this.id} respawned.`);
  }

  public fire(
    _weaponId: string,
    _muzzleData?: {
      position: { x: number; y: number; z: number };
      direction: { x: number; y: number; z: number };
    }
  ): void {
    // Play sound from asset loader
    const sound = AssetLoader.getInstance().getSound('gunshot');
    if (sound) {
      sound.play(); // Play as 2D for now, or use play(0, position) for 3D
    }

    // Muzzle Flash
    let flashPos = this.mesh.position.clone().add(new Vector3(0, 1.5, 0.5)); // Default
    // If we have weaponMesh, try to use its tip
    if (this.weaponMesh) {
      // Estimate tip. If we had a socket, better.
      // Transform relative point
      const matrix = this.weaponMesh.computeWorldMatrix(true);
      flashPos = Vector3.TransformCoordinates(new Vector3(0, 0.2, 0), matrix);
    }

    // Simple particle flash
    this.createMuzzleFlash(flashPos);
  }

  private createMuzzleFlash(position: Vector3): void {
    const particleSystem = new ParticleSystem('muzzleFlash', 10, this.scene);
    particleSystem.particleTexture = new Texture(
      'https://www.babylonjs-playground.com/textures/flare.png',
      this.scene
    );
    particleSystem.emitter = position;
    particleSystem.minEmitBox = new Vector3(0, 0, 0);
    particleSystem.maxEmitBox = new Vector3(0, 0, 0);
    particleSystem.color1 = new Color3(1, 1, 0.5).toColor4();
    particleSystem.color2 = new Color3(1, 0.5, 0).toColor4();
    particleSystem.minSize = 0.2;
    particleSystem.maxSize = 0.5;
    particleSystem.minLifeTime = 0.1;
    particleSystem.maxLifeTime = 0.2;
    particleSystem.emitRate = 100;
    particleSystem.targetStopDuration = 0.1;
    particleSystem.start();
    setTimeout(() => particleSystem.dispose(), 500);
  }

  public dispose(): void {
    super.dispose();
    if (this.weaponMesh) this.weaponMesh.dispose();
    if (this._nameLabel) this._nameLabel.dispose();
    if (this._healthBar) this._healthBar.dispose();
    if (this._healthBarTexture) this._healthBarTexture.dispose();
  }
}
