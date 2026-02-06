import { Scene, Skeleton, Mesh, MeshBuilder, Vector3, AbstractMesh } from '@babylonjs/core';
import { Logger } from '@ante/common';
import { IPawnCore } from '../../types/IPawnCore.js';

const logger = new Logger('MeshUtils');

export interface HeadHitboxOptions {
  size?: number;
  id?: string;
  type?: string;
  pawn?: IPawnCore;
}

export class MeshUtils {
  /**
   * Creates a hitbox attached to the head bone of a skeleton.
   * If no skeleton/bone is found, it will log a warning and return null.
   */
  public static createHeadHitbox(
    scene: Scene,
    skeleton: Skeleton | null,
    rootMesh: AbstractMesh | Mesh,
    options: HeadHitboxOptions = {}
  ): Mesh | null {
    if (!skeleton) {
      logger.warn('Skeleton is null, cannot create head hitbox attached to bone.');
      return null;
    }

    const headBone =
      skeleton.bones.find((b) => b.name.toLowerCase().includes('head')) ??
      skeleton.bones.find((b) => b.name.toLowerCase().includes('neck'));

    if (!headBone) {
      logger.warn('Head/Neck bone not found in skeleton.');
      return null;
    }

    const size = options.size ?? 0.25;
    const id = options.id ?? 'unknown';
    const name = `headBox_${id}`;

    const headBox = MeshBuilder.CreateBox(name, { size }, scene);

    // Attempt to attach to transform node first (cleaner in newer Babylon versions)
    const transformNode = headBone.getTransformNode();
    if (transformNode) {
      headBox.parent = transformNode;
      headBox.position = Vector3.Zero();
      headBox.rotation = Vector3.Zero();
    } else {
      try {
        headBox.attachToBone(headBone, rootMesh);
      } catch (e) {
        logger.error(`Failed to attach headbox to bone: ${e}`);
        headBox.dispose();
        return null;
      }
    }

    headBox.visibility = 0; // Invisible by default
    headBox.checkCollisions = true;
    headBox.isPickable = true;

    headBox.metadata = {
      type: options.type ?? 'unknown',
      id: id,
      bodyPart: 'head',
      pawn: options.pawn,
    };

    return headBox;
  }
}
