import { Vector3 } from '@babylonjs/core';
import { INetworkAuthority } from '../network/INetworkAuthority';
import { EventCode } from '@ante/common';

/**
 * 타겟(Respawnable Targets)의 스폰 스케줄링 및 권한을 관리하는 베이스 클래스.
 */
export abstract class BaseTargetSpawner {
  constructor(protected authority: INetworkAuthority) {}

  /**
   * 초기 타겟 배치 및 스폰 (Master 전용)
   */
  public spawnInitialTargets(): void {
    if (!this.authority.isMasterClient()) return;

    const distances = [10, 15, 20];

    for (let lane = 0; lane < 5; lane++) {
      const x = (lane - 2) * 7;
      distances.forEach((z) => {
        const isMoving = Math.random() > 0.5;
        const position = new Vector3(x, 1.0, z);
        const id = `target_${lane}_${z}_${Math.random().toString(36).substr(2, 4)}`;
        this.broadcastTargetSpawn(
          id,
          isMoving ? 'moving_target' : 'static_target',
          position,
          isMoving
        );
      });
    }
  }

  public broadcastTargetSpawn(
    id: string,
    type: string,
    position: Vector3,
    isMoving: boolean
  ): void {
    if (!this.authority.isMasterClient()) return;

    this.authority.sendEvent(EventCode.SPAWN_TARGET, {
      type,
      position: { x: position.x, y: position.y, z: position.z },
      id,
      isMoving,
    });
  }

  public broadcastTargetDestroy(targetId: string): void {
    if (!this.authority.isMasterClient()) return;
    this.authority.sendEvent(EventCode.TARGET_DESTROY, { targetId });
  }

  /**
   * 랜덤한 위치 계산 (Master 전용)
   */
  public getRandomTargetPosition(): { position: Vector3; isMoving: boolean } {
    const lane = Math.floor(Math.random() * 5);
    const x = (lane - 2) * 7;
    const z = 10 + Math.random() * 12;
    const isMoving = Math.random() > 0.4;
    return { position: new Vector3(x, 1.0, z), isMoving };
  }
}
