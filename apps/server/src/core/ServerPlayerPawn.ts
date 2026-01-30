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

export class ServerPlayerPawn {
  public mesh: Mesh;
  public id: string;
  public visualMesh: AbstractMesh | null = null;
  public skeleton: Skeleton | null = null;
  public headBox: Mesh | null = null;

  constructor(id: string, scene: Scene, position: Vector3) {
    this.id = id;

    // 1. Root Collider (Pivot at eye level: 1.75m) - Matches RemotePlayerPawn
    this.mesh = MeshBuilder.CreateBox('serverPlayerRoot_' + id, { size: 0.1 }, scene);
    // Initial position logic will be handled by updatePlayerHitbox, usually set to (x, 1.75, z)
    this.mesh.position.copyFrom(position);
    this.mesh.checkCollisions = true;
    this.mesh.isPickable = true;
    this.mesh.metadata = { type: 'player', id: this.id, pawn: this };

    console.log(`[Server] Created ServerPlayerPawn for ${id}`);

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

      console.log(`[Server] Loading model via fs: ${fullPath}`);

      if (!fs.existsSync(fullPath)) {
        console.error(`[Server] File DOES NOT EXIST at: ${fullPath}`);
        return;
      }

      // Read file directly to bypass xhr2/NetworkError issues
      const fileData = fs.readFileSync(fullPath, { encoding: 'base64' });
      const dataUrl = 'data:;base64,' + fileData;

      // Import from data string
      // rootUrl is the data string, fileName is empty
      const result = await SceneLoader.ImportMeshAsync('', dataUrl, '', scene);
      console.log(
        `[Server] ImportMeshAsync finished. Meshes: ${result.meshes.length}, Skeletons: ${result.skeletons.length}`
      );

      this.visualMesh = result.meshes[0]; // Assuming root is 0, or we check common parent
      // In RemotePlayerPawn: entries.rootNodes[0]
      // ImportMeshAsync returns all meshes. dummy3 usually has a __root__ node.
      if (!this.visualMesh) {
        console.error(`[Server] No visual mesh found in loaded model!`);
        return;
      }
      console.log(`[Server] Visual Root Name: ${this.visualMesh.name}`);

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

        // Debug Animation Ranges
        console.log(
          `[Server] Skeleton ${this.skeleton.name} has ${this.skeleton.getAnimationRanges()?.length || 0} ranges.`
        );
        this.skeleton.getAnimationRanges()?.forEach((r) => {
          if (r) console.log(`[Server] Anim: ${r.name} (${r.from}-${r.to})`);
        });

        // Ensure Idle animation is playing so bones are in correct place
        const idleRange = this.skeleton.getAnimationRange('YBot_Idle');
        if (idleRange) {
          console.log(`[Server] Playing Idle Animation for ${this.id}`);
          scene.beginAnimation(this.skeleton, idleRange.from, idleRange.to, true);
        } else {
          console.warn(`[Server] YBot_Idle not found! Playing default 0-100`);
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

      console.log(`[Server] Model loaded successfully for ${this.id}`);
    } catch (e) {
      console.error(`[Server] Failed to load model for ${this.id}:`, e);
    }
  }

  public dispose() {
    this.mesh.dispose();
  }
}
