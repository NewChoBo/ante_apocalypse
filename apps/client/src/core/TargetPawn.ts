import { Mesh, Vector3, Scene, ShadowGenerator, MeshBuilder } from '@babylonjs/core';
import { BasePawn } from './BasePawn';
import { IWorldEntity } from '@ante/game-core';
import { TargetMeshComponent } from './components/target/TargetMeshComponent';
import { HitReactionComponent } from './components/target/HitReactionComponent';
import { PatternMovementComponent } from './components/movement/PatternMovementComponent';
import type { GameContext } from '../types/GameContext';

export interface TargetPawnConfig {
  id: string;
  type: string; // 'static' | 'moving' | 'humanoid' 등
  position: Vector3;
  shadowGenerator: ShadowGenerator;
  isMoving?: boolean;
}

/**
 * 모든 타겟(Static, Moving, Humanoid)을 통합하는 Pawn 클래스.
 * 컴포넌트를 조합하여 다양한 타겟 동작을 구현합니다.
 */
export class TargetPawn extends BasePawn implements IWorldEntity {
  public id: string;
  public type: string;
  public mesh: Mesh;
  public isDead = false;
  // IWorldEntity health properties
  public health: number = 100;
  public maxHealth: number = 100;
  public isActive = true;

  // Components
  public meshComponent: TargetMeshComponent;
  public hitReactionComponent: HitReactionComponent;
  public movementComponent: PatternMovementComponent | null = null;

  constructor(scene: Scene, context: GameContext, config: TargetPawnConfig) {
    super(scene, context);
    this.id = config.id;
    this.type = config.type;

    // 초기값 설정 (Humanoid 등에서 덮어씌워질 수 있음)
    this.damageProfile = {
      multipliers: { head: 2.0, body: 1.0 },
      defaultMultiplier: 1.0,
    };

    // Root Mesh 생성 (빈 컨테이너)
    this.mesh = MeshBuilder.CreateBox(`target_root_${config.id}`, { size: 0.1 }, scene);
    this.mesh.isVisible = false;
    this.mesh.position.copyFrom(config.position);
    this.mesh.checkCollisions = false;

    // 1. Mesh Component (외형 생성)
    this.meshComponent = new TargetMeshComponent(this, scene, {
      targetType: config.type,
      shadowGenerator: config.shadowGenerator,
    });
    this.addComponent(this.meshComponent);

    // 2. Hit Reaction (피격 반응)
    this.hitReactionComponent = new HitReactionComponent(this, scene);
    this.addComponent(this.hitReactionComponent);

    // 3. Movement (선택적)
    if (config.isMoving) {
      this.movementComponent = new PatternMovementComponent(this, scene, context, {
        pattern: 'sine_x', // 기본값, 필요시 확장
        range: 2,
        speed: 0.002,
      });
      this.addComponent(this.movementComponent);
    }
  }

  public initialize(_scene: Scene): void {
    // 필요한 경우 초기화 로직
  }

  public tick(deltaTime: number): void {
    this.updateComponents(deltaTime);
  }

  public takeDamage(
    amount: number,
    _attackerId?: string,
    part?: string,
    _hitPoint?: Vector3
  ): void {
    if (this.isDead || !this.isActive) return;

    this.health -= amount;

    // 피격 반응 효과 재생
    this.hitReactionComponent.playHitEffect(part);

    if (this.health <= 0) {
      this.health = 0;
      this.die();
    }
  }

  public die(): void {
    if (this.isDead) return;
    this.isDead = true;
    this.isActive = false;

    // 파괴 애니메이션 재생은 HitReactionComponent 등이 담당하거나 여기서 직접 처리
    this.hitReactionComponent.playDestroyEffect(() => {
      this.dispose();
    });
  }

  // Common getters
  public get position(): Vector3 {
    return this.mesh.position;
  }

  public set position(value: Vector3) {
    this.mesh.position.copyFrom(value);
  }

  public dispose(): void {
    if (this.mesh && !this.mesh.isDisposed()) {
      this.mesh.dispose();
    }
    super.dispose();
  }
}

