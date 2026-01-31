import { BaseTargetSpawner } from '@ante/game-core';
import { Scene, Vector3, ShadowGenerator, Observer } from '@babylonjs/core';
import { TargetPawn, TargetPawnConfig } from '../TargetPawn';
import { NetworkManager } from '../systems/NetworkManager';
import { WorldEntityManager } from '../systems/WorldEntityManager';

/**
 * 타겟의 스폰 및 리스폰 로직을 담당하는 컴포넌트.
 */
export class TargetSpawnerComponent extends BaseTargetSpawner {
  private scene: Scene;
  private shadowGenerator: ShadowGenerator;
  private worldManager: WorldEntityManager;
  private networkManager: NetworkManager;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _spawnObserver: Observer<any> | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _destroyObserver: Observer<any> | null = null;

  constructor(scene: Scene, shadowGenerator: ShadowGenerator) {
    const netManager = NetworkManager.getInstance();
    super(netManager); // BaseTargetSpawner

    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
    this.worldManager = WorldEntityManager.getInstance();
    this.networkManager = netManager;

    this._spawnObserver = this.networkManager.onTargetSpawn.add((data) => {
      // If I am Master, I already spawned it locally via broadcastTargetSpawn logic?
      // No, broadcastTargetSpawn calls spawnTarget.
      // But if loopback is NOT disabled for "Others", I might double spawn?
      // PhotonProvider sends to "Others". So I won't receive my own event.
      // So this listener is for Remote Spawns.
      const position = new Vector3(data.position.x, data.position.y, data.position.z);
      this.spawnTarget(position, data.isMoving, data.id, data.type);
    });

    this._destroyObserver = this.networkManager.onTargetDestroy.add(() => {
      // Respawn logic is now handled by the authority (server/simulation)
    });
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

    const target = new TargetPawn(this.scene, config);

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
    if (this._spawnObserver) {
      this.networkManager.onTargetSpawn.remove(this._spawnObserver);
      this._spawnObserver = null;
    }
    if (this._destroyObserver) {
      this.networkManager.onTargetDestroy.remove(this._destroyObserver);
      this._destroyObserver = null;
    }
  }
}
