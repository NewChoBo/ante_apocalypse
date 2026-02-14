import { Vector3, AbstractMesh } from '@babylonjs/core';
import { Vector3 as commonVector3 } from '@ante/common';
import { BaseEnemyManager } from '../../systems/BaseEnemyManager.js';
import { ServerEnemyPawn } from '../pawns/ServerEnemyPawn.js';
import { ServerPlayerPawn } from '../pawns/ServerPlayerPawn.js';
import { ServerGameContext } from '../../types/ServerGameContext.js';

/**
 * 서버측 적(Enemy) 관리자.
 */
export class ServerEnemyManager extends BaseEnemyManager {
  constructor(
    private ctx: ServerGameContext,
    private getPlayers: () => Map<string, ServerPlayerPawn>
  ) {
    super(ctx.networkManager, ctx.tickManager);
  }

  public override requestSpawnEnemy(id: string, position: commonVector3): boolean {
    if (!super.requestSpawnEnemy(id, new Vector3(position.x, position.y, position.z))) return false;

    // Create server-side representation
    const pawn = new ServerEnemyPawn(id, this.ctx, new Vector3(position.x, position.y, position.z));
    this.pawns.set(id, pawn);
    this.ctx.worldManager.register(pawn);

    // Register AI
    const players = this.getPlayers();
    const target = players.values().next().value;
    this.onEnemySpawned(id, pawn, target);
    return true;
  }

  public getEnemyMesh(id: string): AbstractMesh | undefined {
    return (this.pawns.get(id) as ServerEnemyPawn)?.mesh;
  }

  public getEnemyPawn(id: string): ServerEnemyPawn | undefined {
    return this.pawns.get(id) as ServerEnemyPawn | undefined;
  }

  public destroyEnemy(id: string): void {
    const pawn = this.getEnemyPawn(id);
    if (!pawn) return;

    this.requestDestroyEnemy(id);
    this.ctx.worldManager.unregister(id);
    pawn.dispose();
    this.pawns.delete(id);
    this.unregisterAI(id);
  }
}
