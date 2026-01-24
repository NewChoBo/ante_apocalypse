import { Scene, Vector3, ShadowGenerator } from '@babylonjs/core';
import { ITarget } from '../../types/ITarget';
import { StaticTarget } from '../../targets/StaticTarget';
import { MovingTarget } from '../../targets/MovingTarget';
import { HumanoidTarget } from '../../targets/HumanoidTarget';
import { TargetRegistry } from '../systems/TargetRegistry';

/**
 * 타겟의 스폰 및 리스폰 로직을 담당하는 컴포넌트.
 */
export class TargetSpawnerComponent {
  private scene: Scene;
  private shadowGenerator: ShadowGenerator;
  private targetIdCounter = 0;
  private registry: TargetRegistry;
  private respawnTimeout: any;

  constructor(scene: Scene, shadowGenerator: ShadowGenerator) {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
    this.registry = TargetRegistry.getInstance();
  }

  /** 초기 타겟 자동 스폰 */
  public spawnInitialTargets(): void {
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
  public spawnTarget(position: Vector3, isMoving: boolean): string {
    // 씬이 제거되었으면 스폰 중단
    if (this.scene.isDisposed) return '';

    const id = `target_${++this.targetIdCounter}`;
    let target: ITarget;

    const randomType = Math.random();
    if (randomType > 0.6) {
      target = new HumanoidTarget(
        this.scene,
        id,
        position.add(new Vector3(0, 0.5, 0)),
        this.shadowGenerator
      );
    } else if (isMoving) {
      target = new MovingTarget(this.scene, id, position, this.shadowGenerator);
    } else {
      target = new StaticTarget(this.scene, id, position, this.shadowGenerator);
    }

    // 레지스트리에 등록
    this.registry.register(target);
    return id;
  }

  /** 일정 시간 후 리스폰 예약 */
  public scheduleRespawn(delayMs: number = 1500): void {
    this.respawnTimeout = setTimeout(() => {
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
