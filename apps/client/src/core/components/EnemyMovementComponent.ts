import { Mesh, Vector3, Scene } from '@babylonjs/core';
import { BaseComponent, IPawnCore } from '@ante/game-core';

interface MovementOwner extends IPawnCore {
  mesh: Mesh;
  isMoving: boolean;
}

/**
 * 적의 이동, 중력 적용, 이동 상태 판단을 담당하는 컴포넌트
 */
export class EnemyMovementComponent extends BaseComponent {
  private moveOwner: MovementOwner;
  private lastPosition: Vector3 = new Vector3();
  private lastMoveTime: number = 0;

  // 이동 감지를 위한 임계값
  private readonly MOVE_THRESHOLD = 0.005;
  private readonly MOVE_GRACE_PERIOD = 200; // ms

  constructor(owner: MovementOwner, scene: Scene) {
    super(owner, scene);
    this.moveOwner = owner;
    this.lastPosition.copyFrom(owner.mesh.position);
  }

  /**
   * 매 프레임 호출 - 이동 상태 판단 및 중력 적용
   */
  public update(deltaTime: number): void {
    const currentPos = this.moveOwner.mesh.position;
    const distance = Vector3.Distance(currentPos, this.lastPosition);
    const now = performance.now();

    // 이동 상태 판단 (grace period로 네트워크 끊김 방지)
    if (distance > this.MOVE_THRESHOLD) {
      this.moveOwner.isMoving = true;
      this.lastMoveTime = now;
    } else if (now - this.lastMoveTime > this.MOVE_GRACE_PERIOD) {
      this.moveOwner.isMoving = false;
    }

    // 중력 적용
    this.applyGravity(deltaTime);

    // 위치 저장
    this.lastPosition.copyFrom(this.moveOwner.mesh.position);
  }

  private applyGravity(deltaTime: number): void {
    if (this.moveOwner.mesh) {
      this.moveOwner.mesh.moveWithCollisions(new Vector3(0, -9.81 * deltaTime, 0));
    }
  }

  /**
   * 이동 명령 처리
   */
  public move(direction: Vector3, speed: number, deltaTime: number): void {
    this.moveOwner.mesh.moveWithCollisions(direction.scale(speed * deltaTime));
    this.moveOwner.isMoving = true;
  }

  /**
   * 특정 지점 바라보기
   */
  public lookAt(targetPoint: Vector3): void {
    this.moveOwner.mesh.lookAt(targetPoint);
  }
}
