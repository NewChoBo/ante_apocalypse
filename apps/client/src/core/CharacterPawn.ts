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
import { Logger } from '@ante/common';
import { HealthBarComponent } from './components/HealthBarComponent';
import { SkeletonAnimationComponent } from '@ante/game-core';
import { CharacterModelLoader } from './components/CharacterModelLoader';

const logger = new Logger('CharacterPawn');

export interface CharacterPawnConfig {
  assetKey: string;
  type: 'player' | 'enemy';
  position: Vector3;
  shadowGenerator: ShadowGenerator;
  healthBarStyle?: 'player' | 'enemy';
  showHealthBar?: boolean;
}

/**
 * 캐릭터 Pawn의 공통 베이스 클래스
 * RemotePlayerPawn과 EnemyPawn이 상속받음
 *
 * 공통 기능:
 * - 모델 로딩 (CharacterModelLoader)
 * - 애니메이션 (SkeletonAnimationComponent)
 * - 체력/피격 처리
 * - 체력바 (HealthBarComponent)
 */
export abstract class CharacterPawn extends BasePawn {
  public mesh: Mesh;
  public isDead = false;
  public isMoving = false;
  public abstract type: string;

  // Common components
  protected modelLoader: CharacterModelLoader;
  protected animationComponent: SkeletonAnimationComponent;
  protected healthBarComponent: HealthBarComponent | null = null;

  protected config: CharacterPawnConfig;

  constructor(scene: Scene, config: CharacterPawnConfig) {
    super(scene);
    this.config = config;

    this.damageProfile = {
      multipliers: { head: 2.0, body: 1.0 },
      defaultMultiplier: 1.0,
    };

    // Create root collider (invisible)
    // Root mesh is now at ground level (feet).
    this.mesh = MeshBuilder.CreateBox(
      `${config.type}Root`,
      { width: 0.5, height: 2, depth: 0.5 },
      scene
    );
    this.mesh.setPivotPoint(new Vector3(0, -1, 0));
    this.mesh.position.copyFrom(config.position); // Ground pivot

    this.mesh.checkCollisions = true;
    this.mesh.isVisible = false;
    this.mesh.metadata = { type: config.type, pawn: this };

    // Health bar component (optional)
    if (config.showHealthBar !== false) {
      this.healthBarComponent = new HealthBarComponent(this, scene, {
        style: config.healthBarStyle ?? config.type,
        width: 1.0,
        height: 0.15,
        yOffset: 2.1, // Adjusted height above ground (0.1m above head)
      });
      this.addComponent(this.healthBarComponent);
    }

    // Model loader component
    this.modelLoader = new CharacterModelLoader(this, scene, {
      assetKey: config.assetKey,
      shadowGenerator: config.shadowGenerator,
      entityType: config.type,
    });
    this.addComponent(this.modelLoader);

    // Animation component
    this.animationComponent = new SkeletonAnimationComponent(this, scene);
    this.addComponent(this.animationComponent);

    // Load model asynchronously
    this.initializeModel();
  }

  protected async initializeModel(): Promise<void> {
    await this.modelLoader.loadModel();

    // Connect skeleton to animation component
    const skeleton = this.modelLoader.getSkeleton();
    if (skeleton) {
      this.animationComponent.initializeSkeleton(skeleton);
    }
  }

  public tick(deltaTime: number): void {
    const prevPosition = this.mesh.position.clone();

    this.updateComponents(deltaTime);

    const currentPosition = this.mesh.position;
    const velocity = currentPosition.subtract(prevPosition).scale(1 / deltaTime);

    // Update animation based on velocity
    if (this.animationComponent) {
      this.animationComponent.updateAnimationByVelocity(velocity);
    }
  }

  public override takeDamage(
    amount: number,
    _attackerId?: string,
    _part?: string,
    _hitPoint?: Vector3
  ): void {
    super.takeDamage(amount, _attackerId, _part, _hitPoint);
  }

  protected override onTakeDamage(
    _amount: number,
    _attackerId?: string,
    _part?: string,
    _hitPoint?: Vector3
  ): void {
    this.healthBarComponent?.updateHealth(this.health);

    // Hit flash effect (fallback box)
    if (this.mesh.isVisible && this.mesh.material instanceof StandardMaterial) {
      this.mesh.material.emissiveColor = Color3.White();
      setTimeout((): void => {
        if (this.mesh.material instanceof StandardMaterial) {
          this.mesh.material.emissiveColor = Color3.Black();
        }
      }, 100);
    }
  }

  protected override onDeath(): void {
    logger.info(`${this.config.type} died`);
    this.mesh.setEnabled(false);
  }

  public dispose(): void {
    super.dispose();
    if (this.mesh && !this.mesh.isDisposed()) {
      this.mesh.dispose();
    }
  }

  // Common getters/setters
  public get position(): Vector3 {
    return this.mesh.position;
  }

  public set position(value: Vector3) {
    this.mesh.position.copyFrom(value);
  }

  public isDisposed(): boolean {
    return this.mesh.isDisposed();
  }

  public updateHealthBar(health: number): void {
    this.healthBarComponent?.updateHealth(health);
  }
}
