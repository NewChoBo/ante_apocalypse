import { Vector3, Scene } from '@babylonjs/core';
import { IPawnComponent, IPawn, Logger } from '@ante/common';
import { IMovable } from './interfaces/IMovable.js';

const logger = new Logger('MovementComponent');

/**
 * Movement configuration options
 */
export interface MovementConfig {
  walkSpeed: number;
  runSpeed?: number;
  acceleration?: number;
  deceleration?: number;
  rotationSpeed?: number;
  canFly?: boolean;
  gravity?: number;
  componentId?: string;
}

/**
 * MovementState - 현재 이동 상태
 */
export interface MovementState {
  velocity: Vector3;
  isMoving: boolean;
  speed: number;
  isRunning: boolean;
}

/**
 * MovementComponent - 순수 이동 로직만 담당하는 컴포넌트
 *
 * 책임:
 * - 속도 기반 이동 계산
 * - 가속/감속 처리
 * - 회전 보간
 * - 중력 적용 (선택적)
 *
 * 비책임 (다른 컴포넌트로 위임):
 * - 경로 계산 (PathfindingComponent)
 * - 목표 추적 (AIComponent가 moveTo 호출)
 * - 도착 판정 (호출자가 처리)
 *
 * 아키텍처 원칙:
 * - 단일 책임 원칙(SRP): 이동 관련 로직만 담당
 * - 인터페이스 분리: IMovable 인터페이스 구현
 */
export class MovementComponent implements IPawnComponent<IPawn>, IMovable {
  public readonly componentId: string;
  public readonly componentType = 'MovementComponent';
  public isActive = true;

  // Configuration (immutable after construction)
  private readonly walkSpeed: number;
  private readonly runSpeed: number;
  private readonly acceleration: number;
  private readonly deceleration: number;
  private readonly rotationSpeed: number;
  private readonly canFly: boolean;
  private readonly gravity: number;

  // State
  private currentVelocity = Vector3.Zero();
  private targetVelocity = Vector3.Zero();
  private isMoving = false;
  private isRunning = false;
  private currentSpeed = 0;

  // Owner reference
  private owner: IPawn | null = null;
  private scene: Scene;

  constructor(scene: Scene, config: MovementConfig) {
    this.scene = scene;
    this.componentId = config.componentId ?? `movement_${Math.random().toString(36).substr(2, 9)}`;
    this.walkSpeed = config.walkSpeed;
    this.runSpeed = config.runSpeed ?? config.walkSpeed * 2;
    this.acceleration = config.acceleration ?? 10;
    this.deceleration = config.deceleration ?? 8;
    this.rotationSpeed = config.rotationSpeed ?? 5;
    this.canFly = config.canFly ?? false;
    this.gravity = config.gravity ?? 9.81;
  }

  // ============================================
  // IPawnComponent Implementation
  // ============================================

  public onAttach(pawn: IPawn): void {
    this.owner = pawn;
    logger.debug(`MovementComponent attached to pawn ${pawn.id}`);
  }

  public update(deltaTime: number): void {
    if (!this.isActive || !this.owner) return;

    // Apply acceleration/deceleration
    this.updateVelocity(deltaTime);

    // Apply movement
    this.applyMovement(deltaTime);

    // Apply gravity if not flying
    if (!this.canFly) {
      this.applyGravity(deltaTime);
    }
  }

  public onDetach(): void {
    this.owner = null;
  }

  public dispose(): void {
    this.onDetach();
  }

  // ============================================
  // IMovable Implementation
  // ============================================

  /**
   * 방향으로 이동 시작
   * @param direction 이동 방향 (정규화 권장)
   * @param speed 이동 속도 (undefined시 자동 선택)
   */
  public move(direction: Vector3, speed?: number): void {
    if (!this.owner) return;

    const targetSpeed = speed ?? (this.isRunning ? this.runSpeed : this.walkSpeed);

    if (direction.lengthSquared() < 0.0001) {
      // 방향이 0이면 정지
      this.stop();
      return;
    }

    this.targetVelocity = direction.normalize().scale(targetSpeed);
    this.isMoving = true;
    this.currentSpeed = targetSpeed;

    // 이동 방향으로 회전
    this.rotateTowards(direction, this.scene.getEngine().getDeltaTime() / 1000);
  }

  /**
   * 특정 위치로 이동
   * @param position 목표 위치
   * @param onArrival 도착 콜백 (선택적)
   *
   * Note: 실제 경로 추적은 호출자(AIComponent 등)가 담당
   * 이 메서드는 단순히 목표 방향으로 move()를 호출함
   */
  public moveTo(position: Vector3, onArrival?: () => void): void {
    if (!this.owner) return;

    const ownerPos = new Vector3(
      this.owner.position.x,
      this.owner.position.y,
      this.owner.position.z
    );

    const direction = position.subtract(ownerPos);
    direction.y = 0; // 수평 이동만

    if (direction.lengthSquared() < 0.0001) {
      // 이미 도착함
      onArrival?.();
      return;
    }

    this.move(direction.normalize());
  }

  /**
   * 이동 정지
   */
  public stop(): void {
    this.targetVelocity = Vector3.Zero();
    this.isMoving = false;
  }

  /**
   * 특정 지점 바라보기
   */
  public lookAt(targetPoint: Vector3): void {
    if (!this.owner) return;

    const ownerPos = new Vector3(
      this.owner.position.x,
      this.owner.position.y,
      this.owner.position.z
    );

    const direction = targetPoint.subtract(ownerPos);
    direction.y = 0;

    if (direction.lengthSquared() > 0.0001) {
      const targetRotation = Math.atan2(direction.x, direction.z);
      this.owner.rotation.y = targetRotation;
    }
  }

  /**
   * 순간 이동
   */
  public teleport(position: Vector3): void {
    if (!this.owner) return;

    this.owner.position = {
      x: position.x,
      y: position.y,
      z: position.z,
    };
    this.currentVelocity = Vector3.Zero();
    this.targetVelocity = Vector3.Zero();
    this.isMoving = false;
  }

  /**
   * 현재 속도 반환
   */
  public getVelocity(): Vector3 {
    return this.currentVelocity.clone();
  }

  /**
   * 현재 스피드 반환
   */
  public getSpeed(): number {
    return this.currentVelocity.length();
  }

  /**
   * 이동 중인지 확인
   */
  public getIsMoving(): boolean {
    return this.isMoving;
  }

  /**
   * 목표 지점까지의 남은 거리 반환
   * @param targetPosition 목표 위치
   */
  public getRemainingDistance(targetPosition: Vector3): number {
    if (!this.owner) return Infinity;

    const ownerPos = new Vector3(
      this.owner.position.x,
      this.owner.position.y,
      this.owner.position.z
    );

    return Vector3.Distance(ownerPos, targetPosition);
  }

  // ============================================
  // Additional Public API
  // ============================================

  /**
   * 달리기 상태 설정
   */
  public setRunning(running: boolean): void {
    this.isRunning = running;
    if (this.isMoving) {
      this.currentSpeed = running ? this.runSpeed : this.walkSpeed;
      const currentDir = this.targetVelocity.normalize();
      if (currentDir.lengthSquared() > 0.0001) {
        this.targetVelocity = currentDir.scale(this.currentSpeed);
      }
    }
  }

  /**
   * 달리기 중인지 확인
   */
  public getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 현재 이동 상태 반환
   */
  public getState(): MovementState {
    return {
      velocity: this.currentVelocity.clone(),
      isMoving: this.isMoving,
      speed: this.currentSpeed,
      isRunning: this.isRunning,
    };
  }

  // ============================================
  // Private Methods
  // ============================================

  private updateVelocity(deltaTime: number): void {
    if (this.isMoving) {
      // 가속
      const diff = this.targetVelocity.subtract(this.currentVelocity);
      const maxDelta = this.acceleration * deltaTime;

      if (diff.length() <= maxDelta) {
        this.currentVelocity = this.targetVelocity.clone();
      } else {
        this.currentVelocity.addInPlace(diff.normalize().scale(maxDelta));
      }
    } else {
      // 감속
      if (this.currentVelocity.lengthSquared() > 0.0001) {
        const decelAmount = this.deceleration * deltaTime;
        if (this.currentVelocity.length() <= decelAmount) {
          this.currentVelocity = Vector3.Zero();
        } else {
          const decelDir = this.currentVelocity.normalize().scale(-1);
          this.currentVelocity.addInPlace(decelDir.scale(decelAmount));
        }
      } else {
        this.currentVelocity = Vector3.Zero();
      }
    }
  }

  private applyMovement(deltaTime: number): void {
    if (!this.owner || this.currentVelocity.lengthSquared() < 0.0001) return;

    const displacement = this.currentVelocity.scale(deltaTime);
    const currentPos = this.owner.position;

    this.owner.position = {
      x: currentPos.x + displacement.x,
      y: currentPos.y + displacement.y,
      z: currentPos.z + displacement.z,
    };
  }

  private applyGravity(deltaTime: number): void {
    if (!this.owner) return;

    // 간단한 지면 충돌 처리
    if (this.owner.position.y > 0) {
      this.currentVelocity.y -= this.gravity * deltaTime;
    } else {
      this.owner.position.y = 0;
      this.currentVelocity.y = Math.max(0, this.currentVelocity.y);
    }
  }

  private rotateTowards(direction: Vector3, deltaTime: number): void {
    if (!this.owner || direction.lengthSquared() < 0.0001) return;

    const targetRotation = Math.atan2(direction.x, direction.z);
    let currentRotation = this.owner.rotation.y;

    // 각도 정규화
    while (targetRotation - currentRotation > Math.PI) currentRotation += Math.PI * 2;
    while (targetRotation - currentRotation < -Math.PI) currentRotation -= Math.PI * 2;

    // 부드러운 보간
    const newRotation =
      currentRotation + (targetRotation - currentRotation) * this.rotationSpeed * deltaTime;
    this.owner.rotation.y = newRotation;
  }
}
