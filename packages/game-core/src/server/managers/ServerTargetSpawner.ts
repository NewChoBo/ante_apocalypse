import { Vector3, AbstractMesh } from '@babylonjs/core';
import { Vector3 as commonVector3 } from '@ante/common';
import { BaseTargetSpawner } from '../../systems/BaseTargetSpawner.js';
import { ServerTargetPawn } from '../pawns/ServerTargetPawn.js';
import { ServerGameContext } from '../../types/ServerGameContext.js';

/**
 * 서버측 타겟 스포너.
 */
export class ServerTargetSpawner extends BaseTargetSpawner {
  private targetPawns: Map<string, ServerTargetPawn> = new Map();

  constructor(private ctx: ServerGameContext) {
    super(ctx.networkManager);
  }

  public override broadcastTargetSpawn(
    id: string,
    type: string,
    position: commonVector3,
    isMoving: boolean
  ): void {
    super.broadcastTargetSpawn(id, type, new Vector3(position.x, position.y, position.z), isMoving);

    // Create server-side mesh for raycast
    const pawn = new ServerTargetPawn(
      id,
      this.ctx,
      new Vector3(position.x, position.y, position.z)
    );
    this.targetPawns.set(id, pawn);
    this.ctx.worldManager.register(pawn);
  }

  public override broadcastTargetDestroy(targetId: string): void {
    super.broadcastTargetDestroy(targetId);

    const pawn = this.targetPawns.get(targetId);
    if (pawn) {
      this.ctx.worldManager.unregister(targetId);
      pawn.dispose();
      this.targetPawns.delete(targetId);
    }
  }

  public getTargetMesh(id: string): AbstractMesh | undefined {
    return this.targetPawns.get(id)?.mesh;
  }

  public getTargetPawn(id: string): ServerTargetPawn | undefined {
    return this.targetPawns.get(id);
  }
}
