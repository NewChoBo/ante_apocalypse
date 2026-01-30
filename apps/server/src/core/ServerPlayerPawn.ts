import {
  Mesh,
  MeshBuilder,
  Scene,
  Vector3,
  AbstractMesh,
  SceneLoader,
  Skeleton,
  AnimationPropertiesOverride,
} from '@babylonjs/core';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '@ante/common';
import { BasePawn } from '@ante/game-core';

const logger = new Logger('ServerPlayerPawn');

export class ServerPlayerPawn extends BasePawn {
  public override mesh: Mesh;
  public visualMesh: AbstractMesh | null = null;
  public skeleton: Skeleton | null = null;
  public headBox: Mesh | null = null;
  public override type = 'player';

  constructor(id: string, scene: Scene, position: Vector3) {
    super(scene);
    this.id = id;

    // 1. Root Collider (Pivot at eye level: 1.75m) - Matches RemotePlayerPawn
    this.mesh = MeshBuilder.CreateBox('serverPlayerRoot_' + id, { size: 0.1 }, scene);
    // Initial position logic will be handled by updatePlayerHitbox, usually set to (x, 1.75, z)
    this.mesh.position.copyFrom(position);
    this.mesh.checkCollisions = true;
    this.mesh.isPickable = true;
    this.mesh.metadata = { type: 'player', id: this.id, pawn: this };

    logger.info(`Created ServerPlayerPawn for ${id}`);

    // 2. Load Model
    this.loadModel(scene);
  }

  private async loadModel(scene: Scene): Promise<void> {
    try {
      // Determine model directory based on CWD
      const cwd = process.cwd();
      let modelDir = '';
      if (cwd.endsWith('server') || cwd.endsWith('server\\')) {
        modelDir = path.join(cwd, 'assets/models/');
      } else {
        modelDir = path.join(cwd, 'apps/server/assets/models/');
      }
      const modelFile = 'dummy3.babylon';
      const fullPath = path.join(modelDir, modelFile);

      logger.info(`Loading model via fs: ${fullPath}`);

      if (!fs.existsSync(fullPath)) {
        logger.error(`File DOES NOT EXIST at: ${fullPath}`);
        return;
      }

      // Read file directly to bypass xhr2/NetworkError issues
      const fileData = fs.readFileSync(fullPath, { encoding: 'base64' });
      const dataUrl = 'data:;base64,' + fileData;

      // Import from data string
      // rootUrl is the data string, fileName is empty
      const result = await SceneLoader.ImportMeshAsync('', dataUrl, '', scene);
      logger.info(
        `ImportMeshAsync finished. Meshes: ${result.meshes.length}, Skeletons: ${result.skeletons.length}`
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

      // Pivot is at eye level (1.75m), visual model feet at -1.75m -- Matches RemotePlayerPawn
      this.visualMesh.position = new Vector3(0, -1.75, 0);
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
        // Animation overrides to ensure T-pose or Idle doesn't distort too much?
        // Actually we want to sync animation?
        // For now, let's assume 'Idle' pose is enough for basic verification.
        this.skeleton.animationPropertiesOverride = new AnimationPropertiesOverride();
        this.skeleton.animationPropertiesOverride.enableBlending = true;
        this.skeleton.animationPropertiesOverride.blendingSpeed = 0.1;

        // Debug Animation Ranges (Removed for production)

        // Ensure Idle animation is playing so bones are in correct place
        const idleRange = this.skeleton.getAnimationRange('YBot_Idle');
        if (idleRange) {
          logger.info(`Playing Idle Animation for ${this.id}`);
          scene.beginAnimation(this.skeleton, idleRange.from, idleRange.to, true);
        } else {
          logger.warn(`YBot_Idle not found! Playing default 0-100`);
          scene.beginAnimation(this.skeleton, 0, 89, true);
        }

        const headBone = this.skeleton.bones.find((b) => b.name.toLowerCase().includes('head'));
        if (headBone) {
          this.headBox = MeshBuilder.CreateBox('headBox_' + this.id, { size: 0.25 }, scene);
          const transformNode = headBone.getTransformNode();
          if (transformNode) {
            this.headBox.parent = transformNode;
            this.headBox.position = Vector3.Zero();
          } else {
            this.headBox.attachToBone(headBone, this.visualMesh);
          }
          this.headBox.checkCollisions = true;
          this.headBox.isPickable = true;
          this.headBox.metadata = { type: 'player', id: this.id, bodyPart: 'head', pawn: this };
        }
      }

      logger.info(`Model loaded successfully for ${this.id}`);
    } catch (e) {
      logger.error(`Failed to load model for ${this.id}:`, e);
    }
  }

  public tick(_deltaTime: number): void {
    // 서버측에서는 컴포넌트 업데이트 정도만 수행
    this.updateComponents(_deltaTime);
  }

  public takeDamage(amount: number): void {
    if (this.isDead) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.die();
    }
  }

  public die(): void {
    this.isDead = true;
    this.health = 0;
    logger.info(`ServerPlayerPawn ${this.id} died.`);
  }

  public override dispose() {
    super.dispose();
  }
}
