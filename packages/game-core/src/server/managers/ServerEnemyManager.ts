import { Scene, Vector3, AbstractMesh } from '@babylonjs/core';
import { Vector3 as commonVector3 } from '@ante/common';
import { BaseEnemyManager } from '../../systems/BaseEnemyManager.js';
import { ServerEnemyPawn } from '../pawns/ServerEnemyPawn.js';
import { ServerNetworkAuthority } from '../ServerNetworkAuthority.js';
import { ServerPlayerPawn } from '../pawns/ServerPlayerPawn.js';
import { TickManager } from '../../systems/TickManager.js';

export class ServerEnemyManager extends BaseEnemyManager {
  private scene: Scene;

  constructor(
    authority: ServerNetworkAuthority,
    scene: Scene,
    tickManager: TickManager,
    private getPlayers: () => Map<string, ServerPlayerPawn>
  ) {
    super(authority, tickManager);
    this.scene = scene;
  }

  public override requestSpawnEnemy(id: string, position: commonVector3): boolean {
    if (!super.requestSpawnEnemy(id, new Vector3(position.x, position.y, position.z))) return false;

    // Create server-side representation
    const pawn = new ServerEnemyPawn(
      id,
      this.scene,
      new Vector3(position.x, position.y, position.z),
      this.tickManager
    );
    this.pawns.set(id, pawn);

    // [New] Register AI
    // Simple logic: Target the first available player
    const players = this.getPlayers();
    const target = players.values().next().value;
    this.onEnemySpawned(id, pawn, target);
    return true;
  }

  public getEnemyMesh(id: string): AbstractMesh | undefined {
    return (this.pawns.get(id) as ServerEnemyPawn)?.mesh;
  }
}
