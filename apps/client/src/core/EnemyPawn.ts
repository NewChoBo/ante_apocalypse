import {
  Mesh,
  Vector3,
  Scene,
  StandardMaterial,
  Color3,
  MeshBuilder,
  ShadowGenerator,
} from '@babylonjs/core';
import { BasePawn } from './BasePawn';
import { IEnemyPawn } from '@ante/game-core';
import { Logger } from '@ante/common';
import { HealthBarComponent } from './components/HealthBarComponent';
import { EnemyModelLoader } from './components/EnemyModelLoader';
import { EnemyAnimationComponent } from './components/EnemyAnimationComponent';
import { EnemyMovementComponent } from './components/EnemyMovementComponent';

const logger = new Logger('EnemyPawn');

/**
 * 적 Pawn - 컴포넌트 기반 아키텍처
 *
 * Components:
 * - EnemyModelLoader: 모델 로딩, hitbox 생성
 * - EnemyAnimationComponent: 애니메이션 상태 전환
 * - EnemyMovementComponent: 이동, 중력 처리
 * - HealthBarComponent: 체력바 UI
 */
export class EnemyPawn extends BasePawn implements IEnemyPawn {
  public mesh: Mesh;
  public isDead = false;
  public isMoving = false;
  public type = 'enemy';

  // Components
  private modelLoader: EnemyModelLoader;
  private animationComponent: EnemyAnimationComponent;
  private movementComponent: EnemyMovementComponent;
  private healthBarComponent: HealthBarComponent;

  constructor(scene: Scene, position: Vector3, shadowGenerator: ShadowGenerator) {
    super(scene);

    this.damageProfile = {
      multipliers: { head: 2.0, body: 1.0 },
      defaultMultiplier: 1.0,
    };

    // Create root collider (invisible)
    this.mesh = MeshBuilder.CreateBox('enemyRoot', { width: 0.5, height: 2, depth: 0.5 }, scene);
    this.mesh.position.copyFrom(position);
    this.mesh.position.y += 1.0;
    this.mesh.checkCollisions = true;
    this.mesh.isVisible = false;
    this.mesh.metadata = { type: 'enemy', pawn: this };

    // Initialize components
    this.healthBarComponent = new HealthBarComponent(this, scene, {
      style: 'enemy',
      width: 1.0,
      height: 0.15,
      yOffset: 2.0,
    });
    this.addComponent(this.healthBarComponent);

    this.modelLoader = new EnemyModelLoader(this, scene, shadowGenerator);
    this.addComponent(this.modelLoader);

    this.animationComponent = new EnemyAnimationComponent(this, scene);
    this.addComponent(this.animationComponent);

    this.movementComponent = new EnemyMovementComponent(this, scene);
    this.addComponent(this.movementComponent);

    // Load model asynchronously
    this.initializeModel();
  }

  private async initializeModel(): Promise<void> {
    await this.modelLoader.loadModel();

    // Connect skeleton to animation component
    const skeleton = this.modelLoader.getSkeleton();
    if (skeleton) {
      this.animationComponent.setSkeleton(skeleton);
    }
  }

  public initialize(_scene: Scene): void {
    // Required by interface
  }

  public tick(deltaTime: number): void {
    this.updateComponents(deltaTime);
  }

  public takeDamage(
    amount: number,
    _attackerId?: string,
    _part?: string,
    _hitPoint?: Vector3
  ): void {
    if (this.isDead) return;

    this.health -= amount;
    this.healthBarComponent.updateHealth(this.health);

    // Hit flash effect (fallback box only)
    if (this.mesh.isVisible && this.mesh.material instanceof StandardMaterial) {
      this.mesh.material.emissiveColor = Color3.White();
      setTimeout((): void => {
        if (this.mesh.material instanceof StandardMaterial) {
          this.mesh.material.emissiveColor = Color3.Black();
        }
      }, 100);
    }

    if (this.health <= 0) {
      this.die();
    }
  }

  public die(): void {
    if (this.isDead) return;
    this.isDead = true;
    logger.info('Died');
    this.mesh.setEnabled(false);
  }

  public dispose(): void {
    super.dispose();
    if (this.mesh && !this.mesh.isDisposed()) {
      this.mesh.dispose();
    }
  }

  // Public getters
  public get position(): Vector3 {
    return this.mesh.position;
  }

  public isDisposed(): boolean {
    return this.mesh.isDisposed();
  }

  // Delegated methods
  public updateHealthBar(health: number): void {
    this.healthBarComponent.updateHealth(health);
  }

  public lookAt(targetPoint: Vector3): void {
    this.movementComponent.lookAt(targetPoint);
  }

  public move(direction: Vector3, speed: number, deltaTime: number): void {
    this.movementComponent.move(direction, speed, deltaTime);
  }
}
