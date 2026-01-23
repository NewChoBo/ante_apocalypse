import { Scene, Vector3, ShadowGenerator } from '@babylonjs/core';
import { ITarget } from '../types/ITarget.ts';
import { StaticTarget } from './StaticTarget.ts';
import { MovingTarget } from './MovingTarget.ts';

/**
 * 타겟 매니저.
 * ITarget 인터페이스를 통해 다양한 타겟 타입을 관리합니다.
 */
export class TargetManager {
  private scene: Scene;
  private shadowGenerator: ShadowGenerator;
  private targets: Map<string, ITarget> = new Map();
  private targetIdCounter = 0;

  constructor(scene: Scene, shadowGenerator: ShadowGenerator) {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
  }

  public spawnInitialTargets(): void {
    const distances = [10, 15, 20];

    for (let lane = 0; lane < 5; lane++) {
      const x = (lane - 2) * 7;

      distances.forEach((z) => {
        const isMoving = Math.random() > 0.5;
        this.spawnTarget(new Vector3(x, 1.5, z), isMoving);
      });
    }
  }

  private spawnTarget(position: Vector3, isMoving: boolean): void {
    const id = `target_${++this.targetIdCounter}`;

    let target: ITarget;

    if (isMoving) {
      target = new MovingTarget(this.scene, id, position, this.shadowGenerator);
    } else {
      target = new StaticTarget(this.scene, id, position, this.shadowGenerator);
    }

    this.targets.set(id, target);
  }

  public hitTarget(targetId: string, damage: number): boolean {
    const target = this.targets.get(targetId);
    if (!target || !target.isActive) return false;

    target.takeDamage(damage);

    // 파괴되었으면 맵에서 제거하고 새 타겟 스폰
    if (!target.isActive) {
      this.targets.delete(targetId);
      this.scheduleRespawn();
      return true;
    }

    return false;
  }

  private scheduleRespawn(): void {
    setTimeout(() => {
      const lane = Math.floor(Math.random() * 5);
      const x = (lane - 2) * 7;
      const z = 10 + Math.random() * 12;
      const isMoving = Math.random() > 0.4;
      this.spawnTarget(new Vector3(x, 1.5, z), isMoving);
    }, 1500);
  }

  public update(_deltaTime: number): void {
    // 타겟 업데이트 (필요시 추가 로직)
  }

  public getActiveTargetCount(): number {
    return this.targets.size;
  }
}
