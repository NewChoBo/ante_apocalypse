import { Scene, Vector3, AbstractMesh } from '@babylonjs/core';
import { Vector3 as commonVector3 } from '@ante/common';
import { BaseTargetSpawner } from '../../systems/BaseTargetSpawner.js';
import { ServerTargetPawn } from '../pawns/ServerTargetPawn.js';
import { ServerNetworkAuthority } from '../ServerNetworkAuthority.js';
import { TickManager } from '../../systems/TickManager.js';

export class ServerTargetSpawner extends BaseTargetSpawner {
  private targetPawns: Map<string, ServerTargetPawn> = new Map();
  private scene: Scene;
  private tickManager: TickManager;

  constructor(authority: ServerNetworkAuthority, scene: Scene, tickManager: TickManager) {
    super(authority);
    this.scene = scene;
    this.tickManager = tickManager;
  }

  public override broadcastTargetSpawn(
    id: string,
    type: string,
    position: commonVector3,
    isMoving: boolean
  ): void {
    super.broadcastTargetSpawn(id, type, new Vector3(position.x, position.y, position.z), isMoving);

    // Create server-side mesh for raycast
    // Fix: Convert commonVector3 (interface) to Babylon Vector3 (class)
    const pawn = new ServerTargetPawn(
      id,
      this.scene,
      new Vector3(position.x, position.y, position.z),
      this.tickManager
    );
    this.targetPawns.set(id, pawn);
  }

  public override broadcastTargetDestroy(targetId: string): void {
    super.broadcastTargetDestroy(targetId);

    const pawn = this.targetPawns.get(targetId);
    if (pawn) {
      pawn.dispose();
      this.targetPawns.delete(targetId);
    }
  }

  public getTargetMesh(id: string): AbstractMesh | undefined {
    return this.targetPawns.get(id)?.mesh;
  }
}
