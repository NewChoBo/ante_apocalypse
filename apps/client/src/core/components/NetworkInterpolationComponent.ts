import { Vector3, Mesh, Scene } from '@babylonjs/core';
import { BaseComponent } from './BaseComponent';
import { BasePawn } from '../BasePawn';

interface MeshOwner extends BasePawn {
  mesh: Mesh;
}

/**
 * 네트워크 위치/회전 보간을 담당하는 컴포넌트
 * RemotePlayerPawn에서 분리됨
 */
export class NetworkInterpolationComponent extends BaseComponent {
  private targetPosition: Vector3;
  private targetRotation: Vector3;
  private lerpSpeed = 25;
  private _isMoving = false;
  private ownerMesh: Mesh;

  constructor(owner: MeshOwner) {
    super(owner, owner['scene'] as Scene);
    this.ownerMesh = owner.mesh;
    this.targetPosition = owner.mesh.position.clone();
    this.targetRotation = new Vector3(0, 0, 0);
  }

  /**
   * 현재 움직이고 있는지 여부
   */
  public get isMoving(): boolean {
    return this._isMoving;
  }

  /**
   * 네트워크에서 받은 목표 위치/회전 설정
   */
  public updateTarget(
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number }
  ): void {
    this.targetPosition.set(position.x, position.y, position.z);
    this.targetRotation.set(rotation.x, rotation.y, rotation.z);
  }

  /**
   * 매 프레임 보간 업데이트
   */
  public update(deltaTime: number): void {
    const mesh = this.ownerMesh;
    if (!mesh) return;

    const currentDist = Vector3.Distance(mesh.position, this.targetPosition);
    this._isMoving = currentDist > 0.02;

    // Snap to position if difference is too large (e.g. Teleport or Spawn)
    if (currentDist > 3.0) {
      mesh.position.copyFrom(this.targetPosition);
      this._isMoving = false;
    } else {
      // Position Interpolation
      mesh.position = Vector3.Lerp(
        mesh.position,
        this.targetPosition,
        Math.min(1.0, deltaTime * this.lerpSpeed)
      );
    }

    // Yaw (Y) Rotation Interpolation
    const targetYaw = this.targetRotation.y;
    let diffYaw = targetYaw - mesh.rotation.y;

    // Normalize angle difference
    while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
    while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
    mesh.rotation.y += diffYaw * deltaTime * this.lerpSpeed;
  }

  /**
   * 현재 목표 Pitch 값 (헤드 회전용)
   */
  public getTargetPitch(): number {
    return this.targetRotation.x;
  }
}
