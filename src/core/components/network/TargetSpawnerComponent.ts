import { Scene, Vector3, ShadowGenerator, Mesh, Observer } from '@babylonjs/core';
import { BaseComponent } from '@/core/components/base/BaseComponent';
import { StaticTarget } from '../../../targets/StaticTarget';
import { MovingTarget } from '../../../targets/MovingTarget';
import { HumanoidTarget } from '../../../targets/HumanoidTarget';
import { NetworkMediator } from '../../network/NetworkMediator';
import {
  EventCode,
  TargetSpawnData,
  TargetDestroyData,
} from '../../../shared/protocol/NetworkProtocol';
import { WorldEntityManager } from '../../entities/WorldEntityManager';
import { IWorldEntity } from '../../../types/IWorldEntity';
import type { IPawn } from '../../../types/IPawn';

/**
 * 타겟의 스폰 및 리스폰 로직을 담당하는 컴포넌트.
 */
export class TargetSpawnerComponent extends BaseComponent {
  public name = 'TargetSpawner';
  private shadowGenerator: ShadowGenerator;
  private targetIdCounter = 0;
  private worldManager: WorldEntityManager;
  private respawnTimeout: ReturnType<typeof setTimeout> | null = null;
  private networkMediator: NetworkMediator;

  private spawnObserver: Observer<TargetSpawnData> | null = null;
  private destroyObserver: Observer<TargetDestroyData> | null = null;

  constructor(owner: IPawn, scene: Scene, shadowGenerator: ShadowGenerator) {
    super(owner, scene);
    this.shadowGenerator = shadowGenerator;
    this.worldManager = WorldEntityManager.getInstance();
    this.networkMediator = NetworkMediator.getInstance();
  }

  public attach(target: Mesh): void {
    super.attach(target);

    this.spawnObserver = this.networkMediator.onTargetSpawnRequested.add((data) => {
      const pos = new Vector3(data.position.x, data.position.y, data.position.z);
      this.spawnTarget(pos, data.isMoving, data.id, data.type);
    });

    this.destroyObserver = this.networkMediator.onTargetDestroyed.add(() => {
      this.scheduleRespawn();
    });
  }

  public detach(): void {
    if (this.spawnObserver) {
      this.networkMediator.onTargetSpawnRequested.remove(this.spawnObserver);
      this.spawnObserver = null;
    }
    if (this.destroyObserver) {
      this.networkMediator.onTargetDestroyed.remove(this.destroyObserver);
      this.destroyObserver = null;
    }
    super.detach();
  }

  public update(_deltaTime: number): void {
    // 스폰 로직은 이벤트 및 타이머 기반으로 처리
  }

  /** 초기 타겟 자동 스폰 */
  public spawnInitialTargets(): void {
    if (!this.networkMediator.isMasterClient()) {
      return;
    }

    console.log('[TargetSpawner] Master client spawning initial targets.');

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
      if (!this.networkMediator.isMasterClient()) return '';
      id = `target_${++this.targetIdCounter}_${Math.random().toString(36).substr(2, 4)}`;

      if (!type) {
        const randomType = Math.random();
        if (randomType > 0.6) type = 'humanoid_target';
        else type = isMoving ? 'moving_target' : 'static_target';
      }

      this.networkMediator.sendEvent(EventCode.SPAWN_TARGET, {
        type,
        position: { x: position.x, y: position.y, z: position.z },
        id,
        isMoving,
      });

      // Server/Master Logic: Send event and wait for echo to create visual.
      return id;
    }

    // Client Logic: Check duplication
    if (this.worldManager.getEntity(id)) {
      return id;
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
    if (!this.networkMediator.isMasterClient()) return;

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
