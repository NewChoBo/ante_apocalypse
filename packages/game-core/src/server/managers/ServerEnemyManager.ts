import { Scene, Vector3, AbstractMesh } from '@babylonjs/core';
import { Vector3 as commonVector3 } from '@ante/common';
import { BaseEnemyManager } from '../../systems/BaseEnemyManager.js';
import { ServerEnemyPawn } from '../pawns/ServerEnemyPawn.js';
import { ServerNetworkAuthority } from '../ServerNetworkAuthority.js';
import { ServerPlayerPawn } from '../pawns/ServerPlayerPawn.js';

export class ServerEnemyManager extends BaseEnemyManager {
  private enemyPawns: Map<string, ServerEnemyPawn> = new Map();
  private scene: Scene;

  constructor(
    authority: ServerNetworkAuthority,
    scene: Scene,
    private getPlayers: () => Map<string, ServerPlayerPawn>
  ) {
    super(authority);
    this.scene = scene;
  }

  public override requestSpawnEnemy(id: string, position: commonVector3): boolean {
    if (!super.requestSpawnEnemy(id, new Vector3(position.x, position.y, position.z))) return false;

    // Create server-side representation
    const pawn = new ServerEnemyPawn(
      id,
      this.scene,
      new Vector3(position.x, position.y, position.z)
    );
    this.enemyPawns.set(id, pawn);

    // [New] Register AI
    // Simple logic: Target the first available player
    const players = this.getPlayers();
    const target = players.values().next().value;
    this.onEnemySpawned(id, pawn, target);
    return true;
  }

  public getEnemyMesh(id: string): AbstractMesh | undefined {
    return this.enemyPawns.get(id)?.mesh;
  }

  protected getEnemyPawn(id: string): ServerEnemyPawn | undefined {
    return this.enemyPawns.get(id);
  }

  public getEnemyStates(): {
    id: string;
    position: commonVector3;
    rotation: commonVector3;
    health: number;
    isDead: boolean;
  }[] {
    const states: {
      id: string;
      position: commonVector3;
      rotation: commonVector3;
      health: number;
      isDead: boolean;
    }[] = [];
    this.enemyPawns.forEach((pawn, id) => {
      states.push({
        id,
        position: { x: pawn.mesh.position.x, y: pawn.mesh.position.y, z: pawn.mesh.position.z },
        rotation: { x: pawn.mesh.rotation.x, y: pawn.mesh.rotation.y, z: pawn.mesh.rotation.z },
        health: pawn.health,
        isDead: pawn.isDead,
      });
    });
    return states;
  }
}
