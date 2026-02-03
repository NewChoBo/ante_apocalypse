import {
  Mesh,
  Scene,
  UniversalCamera,
  Vector3,
  Animation as BabylonAnimation,
} from '@babylonjs/core';
import { BasePawn } from './BasePawn';
import { Logger } from '@ante/common';
import type { EntityType, DamageProfile } from '@ante/common';

const logger = new Logger('PlayerPawn');
import { CharacterMovementComponent } from './components/CharacterMovementComponent';
import { CameraComponent } from './components/CameraComponent';
import { CombatComponent } from './components/CombatComponent';
import { GameAssets } from './GameAssets';
import { HealthBarComponent } from './components/HealthBarComponent';

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
  crouch: boolean;
  aim: boolean;
}

export interface MouseDelta {
  x: number;
  y: number;
}

import { playerHealthStore } from './store/GameStore';

/**
 * 1인칭 플레이어 캐릭터 실체 (Pawn).
 */
export class PlayerPawn extends BasePawn {
  public mesh: Mesh;
  public type: EntityType = 'player';
  public damageProfile: DamageProfile;
  private movementComponent: CharacterMovementComponent;
  private cameraComponent: CameraComponent;

  constructor(scene: Scene) {
    super(scene, 'player', 'player_local');

    this.damageProfile = {
      multipliers: { head: 2.0, body: 1.0 },
      defaultMultiplier: 1.0,
    };

    // 초기 체절 동기화 - health component가 있으면 사용
    const healthComponent = this.getComponent<import('@ante/game-core').HealthComponent>('Health');
    if (healthComponent) {
      playerHealthStore.set(healthComponent.health);
    }

    // Root mesh is at ground level (feet)
    this.mesh = Mesh.CreateBox('playerPawn', 0.5, scene);
    this.mesh.isVisible = false;
    this.mesh.position.set(0, 0, -5); // Grounded initial position

    // 물리 충돌 설정 (루트가 지면이므로 ellipsoidOffset 조정)
    this.mesh.checkCollisions = true;
    this.mesh.ellipsoid = new Vector3(0.4, 0.875, 0.4);
    this.mesh.ellipsoidOffset = new Vector3(0, 0.875, 0); // 콜라이더 중심이 지면 위 0.875m

    // 칙칙 컴포넌트 추가 (눈높이: 지면 + 1.75m)
    this.cameraComponent = new CameraComponent(this, scene, 1.75);
    this.addComponent(this.cameraComponent);

    // 이동 컴포넌트 추가
    this.movementComponent = new CharacterMovementComponent();
    this.addComponent(this.movementComponent);
  }

  public get camera(): UniversalCamera {
    return this.cameraComponent.camera;
  }

  public initialize(): void {
    // 추가 초기화 로직
  }

  /** Controller로부터 입력을 받아 처리 */
  public handleInput(keys: InputState, mouseDelta: MouseDelta, deltaTime: number): void {
    // 1. 회전 처리를 컴포넌트에 위임
    this.cameraComponent.handleRotation(mouseDelta);

    // 2. 정조준 상태 업데이트 (무기 시스템에서 통합 관리)
    const combatComp = this.getComponent<CombatComponent>('CombatComponent');
    if (combatComp) {
      combatComp.setAiming(keys.aim);
    }

    // 3. 이동 처리를 컴포넌트에 위임
    this.movementComponent.handleMovement(keys, deltaTime);
  }

  public override tick(deltaTime: number): void {
    // Pawn의 tick 호출하여 모든 컴포넌트 업데이트
    super.tick(deltaTime);
  }

  public takeDamage(
    amount: number,
    _attackerId?: string,
    _part?: string,
    _hitPoint?: Vector3
  ): void {
    // HealthComponent 사용
    const healthComponent = this.getComponent<import('@ante/game-core').HealthComponent>('Health');
    if (!healthComponent || healthComponent.isDead) return;

    // 데미지 적용
    const multiplier =
      this.damageProfile.multipliers[_part ?? 'body'] ?? this.damageProfile.defaultMultiplier;
    healthComponent.takeDamage(amount * multiplier);

    playerHealthStore.set(healthComponent.health);
    logger.info(`Took ${amount} damage. Health: ${healthComponent.health}`);

    if (healthComponent.isDead) {
      this.die();
    }
  }

  public addHealth(amount: number): void {
    const healthComponent = this.getComponent<import('@ante/game-core').HealthComponent>('Health');
    if (!healthComponent || healthComponent.isDead) return;

    healthComponent.heal(amount);
    playerHealthStore.set(healthComponent.health);
    logger.info(`Healed ${amount}. Health: ${healthComponent.health}`);
  }

  public addAmmo(amount: number): void {
    const combatComp = this.getComponent<CombatComponent>('CombatComponent');
    if (combatComp) {
      combatComp.addAmmoToAll(amount);
    }
  }

  private corpseMesh: Mesh | null = null;
  private corpseHealthBar: HealthBarComponent | null = null;

  public die(): void {
    const healthComponent = this.getComponent<import('@ante/game-core').HealthComponent>('Health');
    if (healthComponent?.isDead) return;

    // 죽음 처리
    if (healthComponent) {
      // Health component manages death state internally
    }

    this.mesh.checkCollisions = false; // Disable collisions for ghost mode

    // 1. Create Corpse
    this.createCorpse();

    // 2. Detach camera and hide local mesh
    this.cameraComponent.detach();
    this.mesh.getChildMeshes().forEach((m) => {
      if (m.name !== 'playerPawn') {
        m.setEnabled(false);
      }
    });

    // 3. Hide weapons on death
    const combat = this.getComponent<CombatComponent>('CombatComponent');
    if (combat) {
      const currentWeapon = combat.getCurrentWeapon();
      currentWeapon?.hide();
    }

    logger.info('Died - Entering Ghost Mode');
  }

  private createCorpse(): void {
    try {
      const entries = GameAssets.instantiateModel('enemy', 'corpse_' + this.id);

      if (!entries) return;

      this.corpseMesh = entries.rootNodes[0] as Mesh;
      this.corpseMesh.position.copyFrom(this.mesh.position);
      this.corpseMesh.rotation.copyFrom(this.mesh.rotation);

      // Add a 0-health bar to the corpse
      this.corpseHealthBar = new HealthBarComponent({ mesh: this.corpseMesh } as any, this.scene, {
        style: 'player',
        width: 1.0,
        height: 0.15,
        yOffset: 2.1,
      });
      this.corpseHealthBar.updateHealth(0);

      // Simple death animation for the corpse
      const deathAnim = new BabylonAnimation(
        'deathAnim',
        'rotation.x',
        30,
        BabylonAnimation.ANIMATIONTYPE_FLOAT,
        BabylonAnimation.ANIMATIONLOOPMODE_CONSTANT
      );
      deathAnim.setKeys([
        { frame: 0, value: this.corpseMesh.rotation.x },
        { frame: 30, value: this.corpseMesh.rotation.x - Math.PI / 2 },
      ]);
      this.corpseMesh.animations.push(deathAnim);
      this.scene.beginAnimation(this.corpseMesh, 0, 30, false);
    } catch (e) {
      logger.error('Failed to create corpse mesh', e);
    }
  }

  public respawn(position: Vector3): void {
    // Health reset
    const healthComponent = this.getComponent<import('@ante/game-core').HealthComponent>('Health');
    if (healthComponent) {
      // Reset health
    }

    this.mesh.position.copyFrom(position);
    this.mesh.rotation.x = 0; // Ensure upright
    this.mesh.checkCollisions = true; // Restore collisions

    // 1. Cleanup Corpse
    if (this.corpseMesh) {
      this.corpseMesh.dispose();
      this.corpseMesh = null;
    }
    if (this.corpseHealthBar) {
      this.corpseHealthBar.dispose();
      this.corpseHealthBar = null;
    }

    // 2. Restore local visuals and attach camera
    this.cameraComponent.attach();
    this.mesh.getChildMeshes().forEach((m) => {
      m.setEnabled(true);
    });

    // 3. Show weapons on respawn
    const combat = this.getComponent<CombatComponent>('CombatComponent');
    if (combat) {
      combat.getCurrentWeapon()?.show();
    }

    playerHealthStore.set(100);
    logger.info('Respawned');
  }
}
