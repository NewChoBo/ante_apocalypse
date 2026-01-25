import { Scene, Vector3, ShadowGenerator } from '@babylonjs/core';
import { StaticTarget } from '../../targets/StaticTarget';
import { MovingTarget } from '../../targets/MovingTarget';
import { HumanoidTarget } from '../../targets/HumanoidTarget';
import { NetworkManager } from '../systems/NetworkManager';
import { EventCode } from '../network/NetworkProtocol';
import { WorldEntityManager } from '../systems/WorldEntityManager';
import { IWorldEntity } from '../../types/IWorldEntity';

/**
 * 타겟의 스폰 및 리스폰 로직을 담당하는 컴포넌트.
 */
export class TargetSpawnerComponent {
  private scene: Scene;
  private shadowGenerator: ShadowGenerator;
  private targetIdCounter = 0;
  private worldManager: WorldEntityManager;
  private respawnTimeout: any;
  private networkManager: NetworkManager;

  constructor(scene: Scene, shadowGenerator: ShadowGenerator) {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
    this.worldManager = WorldEntityManager.getInstance();
    this.networkManager = NetworkManager.getInstance();

    this.networkManager.onTargetSpawn.add((data) => {
      this.spawnTarget(data.position, data.isMoving, data.id, data.type);
    });
  }

  /** 초기 타겟 자동 스폰 */
  public spawnInitialTargets(): void {
    if (!this.networkManager.isMasterClient() && this.networkManager.getSocketId()) return;

    const distances = [10, 15, 20];

    for (let lane = 0; lane < 5; lane++) {
      const x = (lane - 2) * 7;
      distances.forEach((z) => {
        const isMoving = Math.random() > 0.5;
        this.spawnTarget(new Vector3(x, 1.0, z), isMoving);
      });
    }
  }

  /** 개별 타겟 스폰 */
  public spawnTarget(position: Vector3, isMoving: boolean, id?: string, type?: string): string {
    if (this.scene.isDisposed) return '';

    if (!id) {
      if (!this.networkManager.isMasterClient() && this.networkManager.getSocketId()) return '';
      id = `target_${++this.targetIdCounter}_${Math.random().toString(36).substr(2, 4)}`;

      if (!type) {
        const randomType = Math.random();
        if (randomType > 0.6) type = 'humanoid_target';
        else type = isMoving ? 'moving_target' : 'static_target';
      }

      this.networkManager.sendEvent(EventCode.SPAWN_TARGET, {
        type,
        position: { x: position.x, y: position.y, z: position.z },
        id,
        isMoving,
      });
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

  /** 일정 시간 후 리스폰 예약 */
  public scheduleRespawn(delayMs: number = 1500): void {
    if (!this.networkManager.isMasterClient() && this.networkManager.getSocketId()) return;

    this.respawnTimeout = setTimeout(() => {
      if (this.scene.isDisposed) return;
      const lane = Math.floor(Math.random() * 5);
      const x = (lane - 2) * 7;
      const z = 10 + Math.random() * 12;
      const isMoving = Math.random() > 0.4;
      this.spawnTarget(new Vector3(x, 1.0, z), isMoving);
    }, delayMs);
  }

  public dispose(): void {
    if (this.respawnTimeout) {
      clearTimeout(this.respawnTimeout);
    }
  }
}
