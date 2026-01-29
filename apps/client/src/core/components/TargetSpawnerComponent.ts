import { Scene, Vector3, ShadowGenerator } from '@babylonjs/core';
import { StaticTarget } from '../../targets/StaticTarget';
import { MovingTarget } from '../../targets/MovingTarget';
import { HumanoidTarget } from '../../targets/HumanoidTarget';
import { NetworkManager } from '../systems/NetworkManager';
import { WorldEntityManager } from '../systems/WorldEntityManager';
import { IWorldEntity } from '@ante/game-core';

/**
 * 타겟의 스폰 및 리스폰 로직을 담당하는 컴포넌트.
 */
export class TargetSpawnerComponent {
  private scene: Scene;
  private shadowGenerator: ShadowGenerator;
  private worldManager: WorldEntityManager;
  private networkManager: NetworkManager;

  constructor(scene: Scene, shadowGenerator: ShadowGenerator) {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
    this.worldManager = WorldEntityManager.getInstance();
    this.networkManager = NetworkManager.getInstance();

    this.networkManager.onTargetSpawn.add((data) => {
      this.spawnTarget(data.position, data.isMoving, data.id, data.type);
    });

    this.networkManager.onTargetDestroy.add(() => {
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

    let target: IWorldEntity;

    if (type === 'humanoid_target' || type === 'humanoid') {
      target = new HumanoidTarget(
        this.scene,
        id!,
        position.add(new Vector3(0, 0.5, 0)),
        this.shadowGenerator
      );
    } else if (type === 'moving_target' || type === 'moving' || isMoving) {
      target = new MovingTarget(this.scene, id!, position, this.shadowGenerator);
    } else {
      target = new StaticTarget(this.scene, id!, position, this.shadowGenerator);
    }

    // WorldManager에 등록
    this.worldManager.registerEntity(target);
    return id!;
  }

  public dispose(): void {}
}
