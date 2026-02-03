import { Vector3, Scene } from '@babylonjs/core';
import { IPawnComponent, IPawn, Logger } from '@ante/common';
import { IMovable, isMovable } from './interfaces/IMovable.js';
import { MovementComponent } from './MovementComponent.js';

const logger = new Logger('AIComponent');

/**
 * AI 행동 상태
 */
export type AIState = 'idle' | 'patrol' | 'chase' | 'attack' | 'flee' | 'dead';

/**
 * AI 설정
 */
export interface AIConfig {
  detectionRange: number;
  attackRange: number;
  loseInterestRange?: number;
  patrolRadius?: number;
  patrolWaitTime?: number;
  attackCooldown?: number;
  componentId?: string;
}

/**
 * AI 타겟 정보
 */
export interface AITarget {
  id: string;
  position: Vector3;
  isValid: boolean;
}

/**
 * AI 행동 콜백
 */
export interface AIBehaviorCallbacks {
  onDetectTarget?: (target: AITarget) => void;
  onLostTarget?: () => void;
  onAttack?: (target: AITarget) => void;
  onPatrolStart?: () => void;
  onPatrolReached?: () => void;
}

/**
 * AI 결정 결과 (Decision)
 *
 * AIComponent가 내리는 결정을 나타냅니다.
 * 실제 실행은 MovementComponent 등이 담당합니다.
 */
export interface AIMovementDecision {
  type: 'move' | 'stop' | 'lookAt';
  direction?: Vector3;
  targetPosition?: Vector3;
  speed?: number;
}

/**
 * AIComponent - 인공지능 의사결정 컴포넌트
 *
 * 책임:
 * - 상태 기반 의사결정 (idle, patrol, chase, attack)
 * - 타겟 감지 및 추적 판단
 * - 행동 콜백 트리거
 *
 * 비책임 (다른 컴포넌트로 위임):
 * - 실제 이동 실행 (IMovable 인터페이스 사용)
 * - 경로 계산 (IPathfinding 인터페이스 사용)
 * - 공격 실행 (콜백으로 위임)
 *
 * 아키텍처 원칙:
 * - 단일 책임 원칙(SRP): AI 의사결정만 담당
 * - 의존성 역전 원칙(DIP): IMovable 인터페이스에 의존
 * - 개방-폐쇄 원칙(OCP): 새로운 AI 행동은 콜백으로 확장
 */
export class AIComponent implements IPawnComponent<IPawn> {
  public readonly componentId: string;
  public readonly componentType = 'AIComponent';
  public isActive = true;

  // Configuration (immutable after construction)
  public readonly detectionRange: number;
  private readonly attackRange: number;
  private readonly loseInterestRange: number;
  private readonly patrolRadius: number;
  private readonly patrolWaitTime: number;
  private readonly attackCooldown: number;

  // State
  private currentState: AIState = 'idle';
  private currentTarget: AITarget | null = null;
  private spawnPosition: Vector3 | null = null;
  private patrolTarget: Vector3 | null = null;
  private stateTimer = 0;
  private attackTimer = 0;
  private isWaitingAtPatrolPoint = false;

  // Dependencies (loosely coupled via interfaces)
  private owner: IPawn | null = null;
  public readonly scene: Scene;
  private movable: IMovable | null = null;

  // Callbacks
  private callbacks: AIBehaviorCallbacks = {};
  private targetProvider: (() => AITarget | null) | null = null;

  constructor(scene: Scene, config: AIConfig) {
    this.scene = scene;
    this.componentId = config.componentId ?? `ai_${Math.random().toString(36).substr(2, 9)}`;
    this.detectionRange = config.detectionRange;
    this.attackRange = config.attackRange;
    this.loseInterestRange = config.loseInterestRange ?? config.detectionRange * 1.5;
    this.patrolRadius = config.patrolRadius ?? 5;
    this.patrolWaitTime = config.patrolWaitTime ?? 2;
    this.attackCooldown = config.attackCooldown ?? 1;
  }

  // ============================================
  // IPawnComponent Implementation
  // ============================================

  public onAttach(pawn: IPawn): void {
    this.owner = pawn;
    this.spawnPosition = new Vector3(pawn.position.x, pawn.position.y, pawn.position.z);

    // 느슨한 결합: IMovable 인터페이스로 의존성 주입
    const movableComponent = pawn.getComponent<MovementComponent>('MovementComponent');
    if (movableComponent && isMovable(movableComponent)) {
      this.movable = movableComponent;
    } else {
      logger.warn(`AIComponent: IMovable not found on pawn ${pawn.id}. Movement will not work.`);
    }

    logger.debug(`AIComponent attached to pawn ${pawn.id}`);
  }

  public update(deltaTime: number): void {
    if (!this.isActive || !this.owner) return;

    this.stateTimer += deltaTime;

    // 쿨다운 업데이트
    if (this.attackTimer > 0) {
      this.attackTimer -= deltaTime;
    }

    // 타겟 업데이트
    this.updateTarget();

    // 상태 머신 업데이트
    this.updateStateMachine(deltaTime);
  }

  public onDetach(): void {
    this.owner = null;
    this.movable = null;
    this.currentTarget = null;
    this.spawnPosition = null;
    this.patrolTarget = null;
  }

  public dispose(): void {
    this.onDetach();
  }

  // ============================================
  // State Machine
  // ============================================

  private updateStateMachine(_deltaTime: number): void {
    // 상태별 업데이트 로직
    switch (this.currentState) {
      case 'idle':
        this.updateIdleState();
        break;
      case 'patrol':
        this.updatePatrolState();
        break;
      case 'chase':
        this.updateChaseState();
        break;
      case 'attack':
        this.updateAttackState();
        break;
      case 'flee':
        this.updateFleeState();
        break;
      case 'dead':
        // 아무것도 하지 않음
        break;
    }
  }

  private updateIdleState(): void {
    // 타겟 감지 확인
    if (this.currentTarget?.isValid) {
      this.transitionToState('chase');
      return;
    }

    // 일정 시간 후 순찰 시작
    if (this.stateTimer > 2) {
      this.transitionToState('patrol');
    }
  }

  private updatePatrolState(): void {
    // 타겟 감지 확인
    if (this.currentTarget?.isValid) {
      this.transitionToState('chase');
      return;
    }

    if (!this.movable) return;

    // 순찰 지점 대기 중
    if (this.isWaitingAtPatrolPoint) {
      if (this.stateTimer >= this.patrolWaitTime) {
        this.isWaitingAtPatrolPoint = false;
        this.pickNewPatrolPoint();
      }
      return;
    }

    // 새로운 순찰 지점 선택
    if (!this.patrolTarget) {
      this.pickNewPatrolPoint();
      return;
    }

    // 순찰 지점 도달 확인
    const distance = this.getDistanceToPosition(this.patrolTarget);

    if (distance < 0.5) {
      this.isWaitingAtPatrolPoint = true;
      this.stateTimer = 0;
      this.movable.stop();

      this.callbacks.onPatrolReached?.();
    } else {
      // 이동 실행
      this.movable.moveTo(this.patrolTarget);
    }
  }

  private updateChaseState(): void {
    if (!this.currentTarget?.isValid || !this.owner) {
      this.transitionToState('idle');
      return;
    }

    const distance = this.getDistanceToPosition(this.currentTarget.position);

    // 공격 범위 진입
    if (distance <= this.attackRange) {
      this.transitionToState('attack');
      return;
    }

    // 흥미 상실
    if (distance > this.loseInterestRange) {
      this.currentTarget = null;
      this.transitionToState('idle');
      return;
    }

    // 추적 실행
    if (this.movable) {
      this.movable.moveTo(this.currentTarget.position);
    }
  }

  private updateAttackState(): void {
    if (!this.currentTarget?.isValid || !this.owner) {
      this.transitionToState('idle');
      return;
    }

    const distance = this.getDistanceToPosition(this.currentTarget.position);

    // 타겟이 공격 범위를 벗어남
    if (distance > this.attackRange) {
      this.transitionToState('chase');
      return;
    }

    // 타겟 바라보기
    if (this.movable) {
      this.movable.lookAt(this.currentTarget.position);
    }

    // 공격 실행
    if (this.attackTimer <= 0) {
      this.performAttack();
    }
  }

  private updateFleeState(): void {
    // 도주 로직 (TODO: 구현)
    if (this.movable && this.currentTarget) {
      const ownerPos = new Vector3(
        this.owner!.position.x,
        this.owner!.position.y,
        this.owner!.position.z
      );
      const fleeDirection = ownerPos.subtract(this.currentTarget.position).normalize();
      this.movable.move(fleeDirection);
    }
  }

  // ============================================
  // State Transitions
  // ============================================

  private transitionToState(newState: AIState): void {
    if (this.currentState === newState) return;

    logger.debug(`AI state transition: ${this.currentState} -> ${newState}`);

    this.onStateExit(this.currentState);
    this.currentState = newState;
    this.stateTimer = 0;
    this.onStateEnter(newState);
  }

  private onStateEnter(state: AIState): void {
    switch (state) {
      case 'patrol':
        this.isWaitingAtPatrolPoint = false;
        this.pickNewPatrolPoint();
        this.callbacks.onPatrolStart?.();
        break;
      case 'chase':
        if (this.currentTarget) {
          this.callbacks.onDetectTarget?.(this.currentTarget);
        }
        break;
      case 'attack':
        this.movable?.stop();
        break;
    }
  }

  private onStateExit(state: AIState): void {
    switch (state) {
      case 'chase':
        this.callbacks.onLostTarget?.();
        break;
      case 'patrol':
        this.movable?.stop();
        break;
    }
  }

  // ============================================
  // Actions
  // ============================================

  private performAttack(): void {
    if (!this.currentTarget) return;

    this.attackTimer = this.attackCooldown;
    this.callbacks.onAttack?.(this.currentTarget);
  }

  private pickNewPatrolPoint(): void {
    if (!this.spawnPosition) return;

    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * this.patrolRadius;

    this.patrolTarget = new Vector3(
      this.spawnPosition.x + Math.cos(angle) * distance,
      this.spawnPosition.y,
      this.spawnPosition.z + Math.sin(angle) * distance
    );
  }

  private updateTarget(): void {
    if (this.targetProvider) {
      this.currentTarget = this.targetProvider();
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  private getDistanceToPosition(position: Vector3): number {
    if (!this.owner) return Infinity;

    const ownerPos = new Vector3(
      this.owner.position.x,
      this.owner.position.y,
      this.owner.position.z
    );

    return Vector3.Distance(ownerPos, position);
  }

  // ============================================
  // Public API
  // ============================================

  public setTargetProvider(provider: () => AITarget | null): void {
    this.targetProvider = provider;
  }

  public setBehaviorCallbacks(callbacks: AIBehaviorCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public forceTarget(target: AITarget): void {
    this.currentTarget = target;
    if (target.isValid) {
      this.transitionToState('chase');
    }
  }

  public clearTarget(): void {
    this.currentTarget = null;
    this.transitionToState('idle');
  }

  public setState(state: AIState): void {
    this.transitionToState(state);
  }

  public getCurrentState(): AIState {
    return this.currentState;
  }

  public getCurrentTarget(): AITarget | null {
    return this.currentTarget;
  }

  public getDistanceToTarget(): number {
    if (!this.currentTarget) return Infinity;
    return this.getDistanceToPosition(this.currentTarget.position);
  }

  public onDeath(): void {
    this.transitionToState('dead');
    this.movable?.stop();
  }

  /**
   * IMovable 의존성 수동 주입 (테스트용)
   */
  public setMovable(movable: IMovable): void {
    this.movable = movable;
  }
}
