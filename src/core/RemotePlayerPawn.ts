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
} from '@babylonjs/core';
import { BasePawn } from './BasePawn';
import { AssetLoader } from './AssetLoader';

/**
 * 다른 네트워크 플레이어를 나타내는 Pawn.
 */
export class RemotePlayerPawn extends BasePawn {
  public mesh: Mesh;
  private targetPosition: Vector3;
  private targetRotation: Vector3;
  private lerpSpeed = 10;
  public id: string;
  public playerName: string;
  private _nameLabel: Mesh | null = null;

  // Visuals & Animation
  private visualMesh: AbstractMesh | null = null;
  private skeleton: Skeleton | null = null;
  private headBoneNode: any = null;
  private shadowGenerator: ShadowGenerator;
  private weaponMesh: AbstractMesh | null = null;
  private currentWeaponId: string | null = null;

  // Animation Ranges
  private idleRange: any;
  private walkRange: any;
  private isMoving = false;
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

    // 1. Root Collider (Pivot at eye level: 1.75m)
    this.mesh = MeshBuilder.CreateBox('remotePlayerRoot_' + id, { size: 0.1 }, scene);
    this.mesh.position.set(0, 1.75, 0);
    this.mesh.isVisible = false;
    this.mesh.checkCollisions = true;

    // Euler rotation synchronization
    this.mesh.rotationQuaternion = null;

    this.createNameLabel(scene, name);

    this.mesh.isPickable = true;
    this.mesh.metadata = {
      type: 'enemy',
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

  public initialize(): void {}

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
        this.headBoneNode =
          this.skeleton.bones.find((b) => b.name.toLowerCase().includes('head')) ||
          this.skeleton.bones.find((b) => b.name.toLowerCase().includes('neck'));
      }

      entries.rootNodes.forEach((node) => {
        if (node instanceof AbstractMesh) {
          node.isPickable = true;
          node.metadata = { type: 'enemy', pawn: this, bodyPart: 'body' };
        }
        node.getChildMeshes().forEach((m) => {
          m.isPickable = true;
          m.metadata = { type: 'enemy', pawn: this, bodyPart: 'body' };
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

      // Pivot/Attachment logic:
      // Hand bone search
      const handBone = this.skeleton?.bones.find(
        (b) =>
          b.name.toLowerCase().includes('righthand') || b.name.toLowerCase().includes('right_hand')
      );

      if (handBone) {
        // Attach to bone
        const boneNode = (handBone as any).getTransformNode();
        if (boneNode) {
          this.weaponMesh.parent = boneNode;
          this.weaponMesh.position = new Vector3(0, 0, 0);
          this.weaponMesh.rotation = new Vector3(Math.PI / 2, 0, 0);
        }
      } else {
        // Fallback: position relative to root
        this.weaponMesh.position = new Vector3(0.3, -0.5, 0.5);
      }

      this.shadowGenerator.addShadowCaster(this.weaponMesh, true);
    } catch (e) {
      console.error('Failed to load remote weapon model:', e);
    }
  }

  public updateNetworkState(
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number }
  ): void {
    this.targetPosition.set(position.x, position.y, position.z);
    this.targetRotation.set(rotation.x, rotation.y, rotation.z);
  }

  public tick(deltaTime: number): void {
    // 1. Calculate movement state
    const posDiff = Vector3.Distance(this.mesh.position, this.targetPosition);
    this.isMoving = posDiff > 0.02;

    // 2. Position Interpolation
    this.mesh.position = Vector3.Lerp(
      this.mesh.position,
      this.targetPosition,
      Math.min(1.0, deltaTime * this.lerpSpeed)
    );

    // 3. Rotation Interpolation
    // Yaw (Y) for body
    let targetYaw = this.targetRotation.y;
    let diffYaw = targetYaw - this.mesh.rotation.y;
    // Normalize angle difference
    while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
    while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
    this.mesh.rotation.y += diffYaw * deltaTime * this.lerpSpeed;

    // Pitch (X) for head (if bone found)
    if (this.headBoneNode) {
      // Simple direct match for now, bones in Babylon might need rotation fix
      // We can simulate looking up/down by rotating the head bone
      // Note: Bones use local space, so this might need adjustment depending on bone axis
      // For Y-Bot GLB, X axis is usually correct for pitch.
      this.headBoneNode.rotation.x = this.targetRotation.x;
    }

    // 4. Update Animations
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

  public takeDamage(amount: number): void {
    console.log(`Remote player ${this.id} hit for ${amount} damage.`);
  }

  public dispose(): void {
    super.dispose();
    if (this.weaponMesh) this.weaponMesh.dispose();
    if (this._nameLabel) this._nameLabel.dispose();
  }
}
