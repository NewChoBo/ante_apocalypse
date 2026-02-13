import { BaseTargetSpawner } from '@ante/game-core';
import { Scene, Vector3, ShadowGenerator } from '@babylonjs/core';
import { TargetPawn, TargetPawnConfig } from '../../TargetPawn';
import { INetworkManager } from '../../interfaces/INetworkManager';
import { WorldEntityManager } from '../../systems/WorldEntityManager';
import type { GameContext } from '../../../types/GameContext';

/**
 * 타겟의 스폰 및 리스폰 로직을 담당하는 컴포넌트.
 */
export class TargetSpawnerComponent extends BaseTargetSpawner {
  private ctx: GameContext;
  private shadowGenerator: ShadowGenerator;
  private scene: Scene;
  private worldManager: WorldEntityManager;
  private networkManager: INetworkManager;
  private cleanups: (() => void)[] = [];

  constructor(context: GameContext, shadowGenerator: ShadowGenerator) {
    super(context.networkManager); // BaseTargetSpawner
    this.ctx = context;
    this.scene = context.scene;
    this.shadowGenerator = shadowGenerator;
    this.worldManager = context.worldManager;
    this.networkManager = context.networkManager;

    const spawnObserver = this.networkManager.onTargetSpawn.add((data) => {
      // If I am Master, I already spawned it locally via broadcastTargetSpawn logic?
      // No, broadcastTargetSpawn calls spawnTarget.
      // But if loopback is NOT disabled for "Others", I might double spawn?
      // PhotonProvider sends to "Others". So I won't receive my own event.
      // So this listener is for Remote Spawns.
      const position = new Vector3(data.position.x, data.position.y, data.position.z);
      this.spawnTarget(position, data.isMoving, data.id, data.type);
    });
    if (spawnObserver) {
      this.cleanups.push(() => this.networkManager.onTargetSpawn.remove(spawnObserver));
    }

    const destroyObserver = this.networkManager.onTargetDestroy.add(() => {
      // Respawn logic is now handled by the authority (server/simulation)
    });
    if (destroyObserver) {
      this.cleanups.push(() => this.networkManager.onTargetDestroy.remove(destroyObserver));
    }
  }

  /** 개별 타겟 스폰 */
  public spawnTarget(position: Vector3, isMoving: boolean, id?: string, type?: string): string {
    if (this.scene.isDisposed) return '';

    if (!id) {
      return '';
    }

    if (!type) type = isMoving ? 'moving_target' : 'static_target';

    const config: TargetPawnConfig = {
      id: id!,
      type: type,
      position: position,
      shadowGenerator: this.shadowGenerator,
      isMoving: isMoving || type === 'moving_target' || type === 'moving',
    };

    const target = new TargetPawn(this.scene, this.ctx, config);

    // WorldManager에 등록
    this.worldManager.registerEntity(target);
    return id!;
  }

  // [Override] Logic for Master Client
  public override broadcastTargetSpawn(
    id: string,
    type: string,
    position: Vector3,
    isMoving: boolean
  ): void {
    super.broadcastTargetSpawn(id, type, position, isMoving); // Sends to Guests
    this.spawnTarget(position, isMoving, id, type); // Spawn Locally
  }

  public override broadcastTargetDestroy(targetId: string): void {
    super.broadcastTargetDestroy(targetId); // Sends to Guests
    // Destroy locally?
    // Target destruction is usually event driven or reactive to health.
    // If we call this, we should ensure local destruction.
    this.worldManager.removeEntity(targetId);
  }

  public dispose(): void {
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups = [];
  }
}

