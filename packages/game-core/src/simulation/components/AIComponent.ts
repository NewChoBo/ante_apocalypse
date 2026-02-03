import { Vector3, Scene } from '@babylonjs/core';
import { IPawnComponent, IPawn, Logger } from '@ante/common';
import { MovementComponent } from './MovementComponent.js';

const logger = new Logger('AIComponent');

/**
 * AI behavior states
 */
export type AIState = 'idle' | 'patrol' | 'chase' | 'attack' | 'flee' | 'dead';

/**
 * AI configuration options
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
 * AI target information
 */
export interface AITarget {
  id: string;
  position: Vector3;
  isValid: boolean;
}

/**
 * AI behavior callbacks
 */
export interface AIBehaviorCallbacks {
  onDetectTarget?: (target: AITarget) => void;
  onLostTarget?: () => void;
  onAttack?: (target: AITarget) => void;
  onPatrolStart?: () => void;
  onPatrolReached?: () => void;
}

/**
 * AIComponent - Server-side AI behavior for enemy pawns
 *
 * This component handles:
 * - Target detection and tracking
 * - State machine (idle, patrol, chase, attack)
 * - Behavior callbacks for game-specific logic
 *
 * Usage:
 * ```typescript
 * const ai = new AIComponent(scene, {
 *   detectionRange: 10,
 *   attackRange: 2,
 *   patrolRadius: 5
 * });
 * pawn.addComponent(ai);
 * ai.setBehaviorCallbacks({
 *   onDetectTarget: (target) => console.log('Target detected!')
 * });
 * ```
 */
export class AIComponent implements IPawnComponent<IPawn> {
  public readonly componentId: string;
  public readonly componentType = 'AIComponent';
  public isActive = true;

  // Configuration
  public readonly detectionRange: number;
  private attackRange: number;
  private loseInterestRange: number;
  private patrolRadius: number;
  private patrolWaitTime: number;
  private attackCooldown: number;

  // State
  private currentState: AIState = 'idle';
  private currentTarget: AITarget | null = null;
  private spawnPosition: Vector3 | null = null;
  private patrolTarget: Vector3 | null = null;
  private stateTimer = 0;
  private attackTimer = 0;
  private isWaitingAtPatrolPoint = false;

  // Owner reference
  private owner: IPawn | null = null;
  public readonly scene: Scene;

  // Movement component reference
  private movementComponent: MovementComponent | null = null;

  // Callbacks
  private callbacks: AIBehaviorCallbacks = {};

  // Target provider function (set externally)
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
    logger.debug(`AIComponent attached to pawn ${pawn.id}`);

    // Try to get movement component
    this.movementComponent = pawn.getComponent<MovementComponent>('MovementComponent') ?? null;
    if (!this.movementComponent) {
      logger.warn(`AIComponent expects MovementComponent on pawn ${pawn.id}`);
    }
  }

  public update(deltaTime: number): void {
    if (!this.isActive || !this.owner) return;

    this.stateTimer += deltaTime;

    // Update attack cooldown
    if (this.attackTimer > 0) {
      this.attackTimer -= deltaTime;
    }

    // Update target reference
    this.updateTarget();

    // State machine
    switch (this.currentState) {
      case 'idle':
        this.updateIdleState(deltaTime);
        break;
      case 'patrol':
        this.updatePatrolState(deltaTime);
        break;
      case 'chase':
        this.updateChaseState(deltaTime);
        break;
      case 'attack':
        this.updateAttackState(deltaTime);
        break;
      case 'flee':
        this.updateFleeState(deltaTime);
        break;
      case 'dead':
        // Do nothing when dead
        break;
    }
  }

  public onDetach(): void {
    this.owner = null;
    this.currentTarget = null;
    this.movementComponent = null;
    this.spawnPosition = null;
    this.patrolTarget = null;
  }

  public dispose(): void {
    this.onDetach();
  }

  // ============================================
  // State Machine
  // ============================================

  private updateIdleState(_deltaTime: number): void {
    // Check for targets
    if (this.currentTarget?.isValid) {
      this.transitionToState('chase');
      return;
    }

    // Start patrolling after a delay
    if (this.stateTimer > 2) {
      this.transitionToState('patrol');
    }
  }

  private updatePatrolState(_deltaTime: number): void {
    // Check for targets
    if (this.currentTarget?.isValid) {
      this.transitionToState('chase');
      return;
    }

    if (!this.movementComponent) return;

    // If waiting at patrol point
    if (this.isWaitingAtPatrolPoint) {
      if (this.stateTimer >= this.patrolWaitTime) {
        this.isWaitingAtPatrolPoint = false;
        this.pickNewPatrolPoint();
      }
      return;
    }

    // If no patrol target, pick one
    if (!this.patrolTarget) {
      this.pickNewPatrolPoint();
      return;
    }

    // Check if reached patrol point
    const ownerPos = new Vector3(
      this.owner!.position.x,
      this.owner!.position.y,
      this.owner!.position.z
    );
    const distance = Vector3.Distance(ownerPos, this.patrolTarget);

    if (distance < 0.5) {
      this.isWaitingAtPatrolPoint = true;
      this.stateTimer = 0;
      this.movementComponent.stop();

      if (this.callbacks.onPatrolReached) {
        this.callbacks.onPatrolReached();
      }
    }
  }

  private updateChaseState(_deltaTime: number): void {
    if (!this.currentTarget?.isValid || !this.owner) {
      this.transitionToState('idle');
      return;
    }

    // Check if target is in attack range
    const ownerPos = new Vector3(
      this.owner.position.x,
      this.owner.position.y,
      this.owner.position.z
    );
    const distance = Vector3.Distance(ownerPos, this.currentTarget.position);

    if (distance <= this.attackRange) {
      this.transitionToState('attack');
      return;
    }

    // Check if lost interest
    if (distance > this.loseInterestRange) {
      this.currentTarget = null;
      this.transitionToState('idle');
      return;
    }

    // Chase target
    if (this.movementComponent) {
      this.movementComponent.moveTo(this.currentTarget.position);
    }
  }

  private updateAttackState(_deltaTime: number): void {
    if (!this.currentTarget?.isValid || !this.owner) {
      this.transitionToState('idle');
      return;
    }

    const ownerPos = new Vector3(
      this.owner.position.x,
      this.owner.position.y,
      this.owner.position.z
    );
    const distance = Vector3.Distance(ownerPos, this.currentTarget.position);

    // Target moved out of attack range
    if (distance > this.attackRange) {
      this.transitionToState('chase');
      return;
    }

    // Face target
    if (this.movementComponent) {
      this.movementComponent.lookAt(this.currentTarget.position);
    }

    // Attack if cooldown is ready
    if (this.attackTimer <= 0) {
      this.performAttack();
    }
  }

  private updateFleeState(_deltaTime: number): void {
    // TODO: Implement flee behavior
    // Move away from target
  }

  // ============================================
  // State Transitions
  // ============================================

  private transitionToState(newState: AIState): void {
    if (this.currentState === newState) return;

    logger.debug(`AI state transition: ${this.currentState} -> ${newState}`);

    // Exit current state
    this.onStateExit(this.currentState);

    // Enter new state
    this.currentState = newState;
    this.stateTimer = 0;
    this.onStateEnter(newState);
  }

  private onStateEnter(state: AIState): void {
    switch (state) {
      case 'patrol':
        this.isWaitingAtPatrolPoint = false;
        this.pickNewPatrolPoint();
        if (this.callbacks.onPatrolStart) {
          this.callbacks.onPatrolStart();
        }
        break;
      case 'chase':
        if (this.currentTarget && this.callbacks.onDetectTarget) {
          this.callbacks.onDetectTarget(this.currentTarget);
        }
        break;
      case 'attack':
        if (this.movementComponent) {
          this.movementComponent.stop();
        }
        break;
    }
  }

  private onStateExit(state: AIState): void {
    switch (state) {
      case 'chase':
        if (this.callbacks.onLostTarget) {
          this.callbacks.onLostTarget();
        }
        break;
      case 'patrol':
        if (this.movementComponent) {
          this.movementComponent.stop();
        }
        break;
    }
  }

  // ============================================
  // Actions
  // ============================================

  private performAttack(): void {
    if (!this.currentTarget) return;

    this.attackTimer = this.attackCooldown;

    if (this.callbacks.onAttack) {
      this.callbacks.onAttack(this.currentTarget);
    }
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

    if (this.movementComponent) {
      this.movementComponent.moveTo(this.patrolTarget);
    }
  }

  private updateTarget(): void {
    if (this.targetProvider) {
      this.currentTarget = this.targetProvider();
    }
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
    if (!this.currentTarget || !this.owner) return Infinity;

    const ownerPos = new Vector3(
      this.owner.position.x,
      this.owner.position.y,
      this.owner.position.z
    );
    return Vector3.Distance(ownerPos, this.currentTarget.position);
  }

  public onDeath(): void {
    this.transitionToState('dead');
    if (this.movementComponent) {
      this.movementComponent.stop();
    }
  }
}
