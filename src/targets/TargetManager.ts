import { Scene, Vector3, ShadowGenerator } from '@babylonjs/core';
import { ITarget } from '../types/ITarget.ts';
import { StaticTarget } from './StaticTarget.ts';
import { MovingTarget } from './MovingTarget.ts';
import { HumanoidTarget } from './HumanoidTarget.ts';
import { ITickable } from '../core/interfaces/ITickable';
import { TickManager } from '../core/TickManager';

/**
 * 타겟 매니저.
 * ITarget 인터페이스를 통해 다양한 타겟 타입을 관리합니다.
 */
export class TargetManager implements ITickable {
  public readonly priority = 30;
  private scene: Scene;
  private shadowGenerator: ShadowGenerator;
  private targets: Map<string, ITarget> = new Map();
  private targetIdCounter = 0;

  constructor(scene: Scene, shadowGenerator: ShadowGenerator) {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
    // TickManager에 자동 등록
    TickManager.getInstance().register(this);
  }

  /** ITickable 인터페이스 구현 */
  public tick(_deltaTime: number): void {
    // 타겟 업데이트 (필요시 추가 로직)
  }

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

  private spawnTarget(position: Vector3, isMoving: boolean): void {
    const id = `target_${++this.targetIdCounter}`;

    let target: ITarget;

    const randomType = Math.random();
    if (randomType > 0.6) {
      // 인간형 타겟
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

    this.targets.set(id, target);
  }

  public hitTarget(targetId: string, part: string, damage: number): boolean {
    const target = this.targets.get(targetId);
    if (!target || !target.isActive) return false;

    target.takeDamage(damage, part);

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
      this.spawnTarget(new Vector3(x, 1.0, z), isMoving);
    }, 1500);
  }

  /** 모든 활성 타겟 목록 반환 */
  public getAllTargets(): ITarget[] {
    return Array.from(this.targets.values()).filter((t) => t.isActive);
  }

  public getActiveTargetCount(): number {
    return this.targets.size;
  }

  public dispose(): void {
    TickManager.getInstance().unregister(this);
  }
}
