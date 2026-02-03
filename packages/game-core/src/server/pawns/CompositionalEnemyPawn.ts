import { Mesh, MeshBuilder, Scene, Vector3 } from '@babylonjs/core';
import { IPawnComponent, Logger } from '@ante/common';
import { Pawn } from '../../simulation/Pawn.js';
import { HealthComponent } from '../../simulation/components/HealthComponent.js';
import {
  MovementComponent,
  MovementConfig,
} from '../../simulation/components/MovementComponent.js';
import {
  AIComponent,
  AIConfig,
  AIBehaviorCallbacks,
  AITarget,
} from '../../simulation/components/AIComponent.js';
import { IEnemyPawn } from '../../types/IEnemyPawn.js';

const logger = new Logger('CompositionalEnemyPawn');

/**
 * CompositionalEnemyPawn 설정
 *
 * 각 컴포넌트별 설정을 분리하여 응집도를 높입니다.
 */
export interface CompositionalEnemyPawnConfig {
  /** HealthComponent 설정 */
  health: {
    maxHealth: number;
    initialHealth?: number;
  };
  /** MovementComponent 설정 */
  movement: MovementConfig;
  /** AIComponent 설정 */
  ai: AIConfig;
}

/**
 * 컴포넌트 팩토리 함수 타입
 *
 * 의존성 주입(DI)을 위한 팩토리 패턴
 */
export type ComponentFactory<T extends IPawnComponent> = (scene: Scene) => T;

/**
 * CompositionalEnemyPawn - 컴포지션 기반 Enemy Pawn
 *
 * 아키텍처 원칙:
 * - 단일 책임 원칙(SRP): 각 컴포넌트가 하나의 책임만 담당
 * - 의존성 역전 원칙(DIP): 추상화에 의존, 구체화에 의존하지 않음
 * - 개방-폐쇄 원칙(OCP): 확장에는 열리고, 수정에는 닫힘
 *
 * 특징:
 * - Builder 패턴 지원
 * - 컴포넌트 팩토리 주입 가능
 * - 느슨한 결합 (컴포넌트 간 인터페이스 기반 통신)
 *
 * 사용 예시:
 * ```typescript
 * // 1. 기본 사용 (팩토리 낶부 생성)
 * const enemy = new CompositionalEnemyPawn(scene, 'enemy_1', position, config);
 *
 * // 2. Builder 패턴 사용
 * const enemy = new CompositionalEnemyPawn.Builder(scene, 'enemy_1', position)
 *   .withHealth({ maxHealth: 100 })
 *   .withMovement({ walkSpeed: 3 })
 *   .withAI({ detectionRange: 10, attackRange: 2 })
 *   .build();
 * ```
 */
export class CompositionalEnemyPawn extends Pawn implements IEnemyPawn {
  public override mesh: Mesh;
  public headBox: Mesh;

  // 컴포넌트 참조 (읽기 전용)
  private _healthComponent: HealthComponent;
  private _movementComponent: MovementComponent;
  private _aiComponent: AIComponent;

  // 설정 (불변)
  private readonly _config: CompositionalEnemyPawnConfig;

  /**
   * 기본 생성자
   */
  constructor(
    scene: Scene,
    id: string,
    position: Vector3,
    config: CompositionalEnemyPawnConfig,
    componentFactories?: {
      health?: ComponentFactory<HealthComponent>;
      movement?: ComponentFactory<MovementComponent>;
      ai?: ComponentFactory<AIComponent>;
    }
  ) {
    // 기본 Pawn 초기화
    super(scene, {
      id,
      type: 'enemy',
      position,
      maxHealth: config.health.maxHealth,
      initialHealth: config.health.initialHealth ?? config.health.maxHealth,
    });

    this._config = config;

    // 메시 생성
    this.mesh = this.createPhysicsMesh(id, scene, position);
    this.headBox = this.createHeadHitbox(id, scene);

    // 컴포넌트 생성 (팩토리 주입 또는 기본 생성)
    this._healthComponent =
      componentFactories?.health?.(scene) ?? this.createDefaultHealthComponent(config.health);
    this._movementComponent =
      componentFactories?.movement?.(scene) ??
      this.createDefaultMovementComponent(scene, config.movement);
    this._aiComponent =
      componentFactories?.ai?.(scene) ?? this.createDefaultAIComponent(scene, config.ai);

    // 컴포넌트 등록
    this.addComponent(this._healthComponent);
    this.addComponent(this._movementComponent);
    this.addComponent(this._aiComponent);

    // 이벤트 설정
    this.setupHealthEvents();

    logger.info(`Created CompositionalEnemyPawn ${id} at ${position}`);
  }

  // ============================================
  // Factory Methods
  // ============================================

  private createDefaultHealthComponent(config: {
    maxHealth: number;
    initialHealth?: number;
  }): HealthComponent {
    return new HealthComponent({
      maxHealth: config.maxHealth,
      initialHealth: config.initialHealth ?? config.maxHealth,
    });
  }

  private createDefaultMovementComponent(scene: Scene, config: MovementConfig): MovementComponent {
    return new MovementComponent(scene, {
      walkSpeed: config.walkSpeed,
      runSpeed: config.runSpeed,
      acceleration: config.acceleration ?? 10,
      deceleration: config.deceleration ?? 8,
      rotationSpeed: config.rotationSpeed ?? 5,
      canFly: config.canFly ?? false,
      gravity: config.gravity ?? 9.81,
    });
  }

  private createDefaultAIComponent(scene: Scene, config: AIConfig): AIComponent {
    return new AIComponent(scene, {
      detectionRange: config.detectionRange,
      attackRange: config.attackRange,
      loseInterestRange: config.loseInterestRange,
      patrolRadius: config.patrolRadius ?? 5,
      patrolWaitTime: config.patrolWaitTime ?? 2,
      attackCooldown: config.attackCooldown ?? 1,
    });
  }

  // ============================================
  // Builder Pattern
  // ============================================

  /**
   * Builder 패턴 시작
   */
  public static Builder(
    scene: Scene,
    id: string,
    position: Vector3
  ): CompositionalEnemyPawnBuilder {
    return new CompositionalEnemyPawnBuilder(scene, id, position);
  }

  // ============================================
  // Mesh Creation
  // ============================================

  private createPhysicsMesh(id: string, scene: Scene, position: Vector3): Mesh {
    const mesh = MeshBuilder.CreateBox(
      'enemyRoot_' + id,
      { width: 0.5, height: 2, depth: 0.5 },
      scene
    );
    mesh.setPivotPoint(new Vector3(0, -1, 0));
    mesh.position.copyFrom(position);
    mesh.checkCollisions = true;
    mesh.isPickable = true;
    mesh.metadata = { type: 'enemy', id: this.id, bodyPart: 'body', pawn: this };

    return mesh;
  }

  private createHeadHitbox(id: string, scene: Scene): Mesh {
    const headBox = MeshBuilder.CreateBox('headBox_' + id, { size: 0.25 }, scene);
    headBox.parent = this.mesh;
    headBox.position = new Vector3(0, 1.75, 0);
    headBox.checkCollisions = true;
    headBox.isPickable = true;
    headBox.metadata = { type: 'enemy', id: this.id, bodyPart: 'head', pawn: this };

    return headBox;
  }

  // ============================================
  // Event Setup
  // ============================================

  private setupHealthEvents(): void {
    this._healthComponent.onDeath.add((event) => {
      logger.info(`CompositionalEnemyPawn ${this.id} died. Killer: ${event.killerId ?? 'unknown'}`);
      this._aiComponent.onDeath();
      this.onDeath();
    });

    this._healthComponent.onDamageTaken.add((event) => {
      logger.debug(
        `CompositionalEnemyPawn ${this.id} took ${event.amount} damage from ${event.attackerId ?? 'unknown'}`
      );
      this.onTakeDamage(event.amount, event.attackerId);
    });
  }

  // ============================================
  // Lifecycle
  // ============================================

  public override activate(): void {
    super.activate();
    logger.debug(`Activated CompositionalEnemyPawn ${this.id}`);
  }

  public override deactivate(): void {
    super.deactivate();
    logger.debug(`Deactivated CompositionalEnemyPawn ${this.id}`);
  }

  public override dispose(): void {
    super.dispose();

    if (this.headBox && !this.headBox.isDisposed()) {
      this.headBox.dispose();
    }

    logger.debug(`Disposed CompositionalEnemyPawn ${this.id}`);
  }

  // ============================================
  // IEnemyPawn Implementation
  // ============================================

  public lookAt(targetPoint: Vector3): void {
    this._movementComponent.lookAt(targetPoint);
  }

  public move(direction: Vector3, speed: number, _deltaTime: number): void {
    this._movementComponent.move(direction, speed);
  }

  // ============================================
  // Public API
  // ============================================

  public setTargetProvider(provider: () => AITarget | null): void {
    this._aiComponent.setTargetProvider(provider);
  }

  public setBehaviorCallbacks(callbacks: AIBehaviorCallbacks): void {
    this._aiComponent.setBehaviorCallbacks(callbacks);
  }

  public forceTarget(target: AITarget): void {
    this._aiComponent.forceTarget(target);
  }

  public clearTarget(): void {
    this._aiComponent.clearTarget();
  }

  public getAIState(): string {
    return this._aiComponent.getCurrentState();
  }

  public getCurrentTarget(): AITarget | null {
    return this._aiComponent.getCurrentTarget();
  }

  public getDistanceToTarget(): number {
    return this._aiComponent.getDistanceToTarget();
  }

  public isMoving(): boolean {
    return this._movementComponent.getIsMoving();
  }

  public getVelocity(): Vector3 {
    return this._movementComponent.getVelocity();
  }

  public getSpeed(): number {
    return this._movementComponent.getSpeed();
  }

  // ============================================
  // Event Handlers (Override 가능)
  // ============================================

  protected onTakeDamage(_amount: number, _attackerId?: string): void {
    // 하위 클래스에서 오버라이드
  }

  protected onDeath(): void {
    logger.info(`Enemy ${this.id} died`);
  }

  // ============================================
  // Getters
  // ============================================

  public get health(): number {
    return this._healthComponent.health;
  }

  public get maxHealth(): number {
    return this._healthComponent.maxHealth;
  }

  public get isDead(): boolean {
    return this._healthComponent.isDead;
  }

  public get healthComponent(): HealthComponent {
    return this._healthComponent;
  }

  public get movementComponent(): MovementComponent {
    return this._movementComponent;
  }

  public get aiComponent(): AIComponent {
    return this._aiComponent;
  }

  public getConfig(): CompositionalEnemyPawnConfig {
    return this._config;
  }

  public override takeDamage(
    amount: number,
    attackerId?: string,
    part?: string,
    hitPoint?: { x: number; y: number; z: number }
  ): void {
    this._healthComponent.takeDamage(amount, attackerId, part, hitPoint);
  }
}

/**
 * CompositionalEnemyPawn Builder
 *
 * 단계적 생성을 위한 빌더 패턴
 */
export class CompositionalEnemyPawnBuilder {
  private scene: Scene;
  private id: string;
  private position: Vector3;
  private healthConfig?: { maxHealth: number; initialHealth?: number };
  private movementConfig?: MovementConfig;
  private aiConfig?: AIConfig;
  private componentFactories?: {
    health?: ComponentFactory<HealthComponent>;
    movement?: ComponentFactory<MovementComponent>;
    ai?: ComponentFactory<AIComponent>;
  };

  constructor(scene: Scene, id: string, position: Vector3) {
    this.scene = scene;
    this.id = id;
    this.position = position;
  }

  /**
   * Health 설정
   */
  public withHealth(config: { maxHealth: number; initialHealth?: number }): this {
    this.healthConfig = config;
    return this;
  }

  /**
   * Movement 설정
   */
  public withMovement(config: MovementConfig): this {
    this.movementConfig = config;
    return this;
  }

  /**
   * AI 설정
   */
  public withAI(config: AIConfig): this {
    this.aiConfig = config;
    return this;
  }

  /**
   * 컴포넌트 팩토리 주입
   */
  public withComponentFactories(factories: {
    health?: ComponentFactory<HealthComponent>;
    movement?: ComponentFactory<MovementComponent>;
    ai?: ComponentFactory<AIComponent>;
  }): this {
    this.componentFactories = factories;
    return this;
  }

  /**
   * Pawn 생성
   */
  public build(): CompositionalEnemyPawn {
    if (!this.healthConfig || !this.movementConfig || !this.aiConfig) {
      throw new Error(
        'CompositionalEnemyPawnBuilder: All configurations must be set before building'
      );
    }

    return new CompositionalEnemyPawn(
      this.scene,
      this.id,
      this.position,
      {
        health: this.healthConfig,
        movement: this.movementConfig,
        ai: this.aiConfig,
      },
      this.componentFactories
    );
  }
}
