import { Mesh, Vector3, Scene, ShadowGenerator, MeshBuilder } from '@babylonjs/core';
import { BasePawn } from './BasePawn';
import { IWorldEntity } from '@ante/game-core';
import { TargetMeshComponent } from './components/TargetMeshComponent';
import { HitReactionComponent } from './components/HitReactionComponent';
import { PatternMovementComponent } from './components/PatternMovementComponent';
import type { EntityType, DamageProfile } from '@ante/common';

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
  public type: EntityType;
  public mesh: Mesh;
  public isActive = true;
  public damageProfile: DamageProfile;

  // Components
  public meshComponent: TargetMeshComponent;
  public hitReactionComponent: HitReactionComponent;
  public movementComponent: PatternMovementComponent | null = null;

  constructor(scene: Scene, config: TargetPawnConfig) {
    super(scene, config.type, config.id);
    this.id = config.id;
    this.type = config.type as EntityType; // BasePawn에서 설정되지만 명시적으로 설정

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
      this.movementComponent = new PatternMovementComponent(this, scene, {
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

  public override tick(deltaTime: number): void {
    // Update all components
    super.tick(deltaTime);
  }

  public takeDamage(amount: number, _attackerId?: string, hitPart?: string): void {
    if (this.isDead) return;

    const multiplier =
      this.damageProfile.multipliers[hitPart ?? 'body'] ?? this.damageProfile.defaultMultiplier;
    const finalDamage = amount * multiplier;

    // Use health component
    const healthComponent = this.getComponent<import('@ante/game-core').HealthComponent>('Health');
    if (healthComponent) {
      healthComponent.takeDamage(finalDamage);
    }

    // 피격 반응
    this.hitReactionComponent?.playHitEffect(hitPart);

    // Check death
    if (healthComponent?.isDead) {
      this.die();
    }
  }

  public die(): void {
    // Set death state via health component
    const healthComponent = this.getComponent<import('@ante/game-core').HealthComponent>('Health');
    if (healthComponent) {
      // Health component manages death state
    }

    // Death animation handled by mesh component if available
    // this.meshComponent?.playDeathAnimation?.();
  }

  public respawn(): void {
    const healthComponent = this.getComponent<import('@ante/game-core').HealthComponent>('Health');
    if (healthComponent) {
      healthComponent.revive();
    }
  }
}
