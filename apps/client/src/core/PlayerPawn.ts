import { Mesh, Scene, UniversalCamera, Vector3 } from '@babylonjs/core';
import { BasePawn } from './BasePawn';
import { Logger } from '@ante/common';

const logger = new Logger('PlayerPawn');
import { CharacterMovementComponent } from './components/CharacterMovementComponent';
import { CameraComponent } from './components/CameraComponent';
import { CombatComponent } from './components/CombatComponent';

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
  public type = 'player';
  private movementComponent: CharacterMovementComponent;
  private cameraComponent: CameraComponent;

  constructor(scene: Scene) {
    super(scene);
    this.id = 'player_local'; // Local player ID
    this.damageProfile = {
      multipliers: { head: 2.0, body: 1.0 },
      defaultMultiplier: 1.0,
    };

    // 초기 체력 동기화
    playerHealthStore.set(this.health);

    // Root mesh is at ground level (feet)
    this.mesh = Mesh.CreateBox('playerPawn', 0.5, scene);
    this.mesh.isVisible = false;
    this.mesh.position.set(0, 0, -5); // Grounded initial position

    // 물리 충돌 설정 (루트가 지면이므로 ellipsoidOffset 조정)
    this.mesh.checkCollisions = true;
    this.mesh.ellipsoid = new Vector3(0.4, 0.875, 0.4);
    this.mesh.ellipsoidOffset = new Vector3(0, 0.875, 0); // 콜라이더 중심이 지면 위 0.875m

    // 카메라 컴포넌트 추가 (눈높이: 지면 + 1.75m)
    this.cameraComponent = new CameraComponent(this, scene, 1.75);
    this.addComponent(this.cameraComponent);

    // 이동 컴포넌트 추가
    this.movementComponent = new CharacterMovementComponent(this, scene);
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
    const combatComp = this.getComponent(CombatComponent);
    if (combatComp instanceof CombatComponent) {
      combatComp.setAiming(keys.aim);
    }

    // 3. 이동 처리를 컴포넌트에 위임
    this.movementComponent.handleMovement(keys, deltaTime);
  }

  public tick(deltaTime: number): void {
    // 모든 컴포넌트 업데이트 호출
    this.updateComponents(deltaTime);
  }

  public takeDamage(
    amount: number,
    _attackerId?: string,
    _part?: string,
    _hitPoint?: Vector3
  ): void {
    if (this.isDead || this.health <= 0) return;

    this.health = Math.max(0, this.health - amount);
    playerHealthStore.set(this.health);

    logger.info(`Took ${amount} damage. Health: ${this.health}`);

    if (this.health <= 0) {
      this.die();
    }
  }

  public addHealth(amount: number): void {
    if (this.health <= 0) return;
    this.health = Math.min(100, this.health + amount);
    playerHealthStore.set(this.health);
    logger.info(`Healed ${amount}. Health: ${this.health}`);
  }

  public addAmmo(amount: number): void {
    const combatComp = this.getComponent(CombatComponent);
    if (combatComp instanceof CombatComponent) {
      combatComp.addAmmoToAll(amount);
    }
  }

  public die(): void {
    if (this.isDead) return;
    this.isDead = true;
    this.mesh.checkCollisions = false; // Disable collisions for ghost mode

    // Hide weapons on death
    const combat = this.getComponent(CombatComponent) as CombatComponent;
    if (combat) {
      combat.getCurrentWeapon()?.hide();
    }

    logger.info('Died - Entering Ghost Mode');
  }

  public respawn(position: Vector3): void {
    this.isDead = false;
    this.health = 100;
    this.mesh.position.copyFrom(position);
    this.mesh.checkCollisions = true; // Restore collisions

    // Show weapons on respawn
    const combat = this.getComponent(CombatComponent) as CombatComponent;
    if (combat) {
      combat.getCurrentWeapon()?.show();
    }

    playerHealthStore.set(100);
    logger.info('Respawned');
  }
}
