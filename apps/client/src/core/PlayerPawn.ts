import { Mesh, UniversalCamera, Vector3, Animation as BabylonAnimation } from '@babylonjs/core';
import { BasePawn } from './BasePawn';
import { Logger } from '@ante/common';
import { CharacterMovementComponent, MovementInput } from './components/CharacterMovementComponent';
import { CameraComponent } from './components/CameraComponent';
import { CombatComponent } from './components/CombatComponent';
import { GameAssets } from './GameAssets';
import { HealthBarComponent } from './components/HealthBarComponent';
import { playerHealthStore } from './store/GameStore';
import type { GameContext } from '../types/GameContext';

const logger = new Logger('PlayerPawn');

/**
 * 1인칭 플레이어 캐릭터 실체 (Pawn).
 */
export class PlayerPawn extends BasePawn {
  public mesh: Mesh;
  public type = 'player';
  private movementComponent: CharacterMovementComponent;
  private cameraComponent: CameraComponent;

  constructor(context: GameContext) {
    super(context.scene, context);
    this.id = 'player_local'; // Local player ID
    this.damageProfile = {
      multipliers: { head: 2.0, body: 1.0 },
      defaultMultiplier: 1.0,
    };

    // 초기 체력 동기화
    playerHealthStore.set(this.health);

    // Root mesh is at ground level (feet)
    this.mesh = Mesh.CreateBox('playerPawn', 0.5, this.scene);
    this.mesh.isVisible = false;
    this.mesh.position.set(0, 0, -5); // Grounded initial position

    // 물리 충돌 설정 (루트가 지면이므로 ellipsoidOffset 조정)
    this.mesh.checkCollisions = true;
    this.mesh.ellipsoid = new Vector3(0.4, 0.875, 0.4);
    this.mesh.ellipsoidOffset = new Vector3(0, 0.875, 0); // 콜라이더 중심이 지면 위 0.875m

    // 카메라 컴포넌트 추가 (눈높이: 지면 + 1.75m)
    this.cameraComponent = new CameraComponent(this, this.scene, 1.75);
    this.addComponent(this.cameraComponent);

    // 이동 컴포넌트 추가
    this.movementComponent = new CharacterMovementComponent(this, this.scene);
    this.addComponent(this.movementComponent);
  }

  public get camera(): UniversalCamera {
    return this.cameraComponent.camera;
  }

  public initialize(): void {
    // 추가 초기화 로직
  }

  /** Controller로부터 입력을 받아 처리 */
  public handleInput(
    keys: MovementInput,
    mouseDelta: { x: number; y: number },
    deltaTime: number
  ): void {
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

  private corpseMesh: Mesh | null = null;
  private corpseHealthBar: HealthBarComponent | null = null;

  public die(): void {
    if (this.isDead) return;
    this.isDead = true;
    this.mesh.checkCollisions = false; // Disable collisions for ghost mode

    // 1. Create Corpse
    this.createCorpse();

    // 2. Hide local visuals and detach camera
    this.cameraComponent.detach();
    // Hide actual model child meshes
    this.mesh.getChildMeshes().forEach((m) => {
      if (m.name.includes('Character') || m.name.includes('Model') || m.id.includes('Character')) {
        m.setEnabled(false);
      }
    });

    // 3. Hide weapons on death
    const combat = this.getComponent(CombatComponent) as CombatComponent;
    if (combat) {
      combat.getCurrentWeapon()?.hide();
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
      this.corpseHealthBar = new HealthBarComponent({ mesh: this.corpseMesh }, this.scene, {
        style: 'player',
        width: 1.0,
        height: 0.15,
        yOffset: 2.1,
      });
      this.corpseHealthBar.updateHealth(0);

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
    this.isDead = false;
    this.health = 100;
    this.mesh.position.copyFrom(position);
    this.mesh.rotation.x = 0; // Ensure upright
    this.mesh.checkCollisions = true; // Restore collisions

    if (this.corpseMesh) {
      this.corpseMesh.dispose();
      this.corpseMesh = null;
    }
    if (this.corpseHealthBar) {
      this.corpseHealthBar.dispose();
      this.corpseHealthBar = null;
    }

    this.cameraComponent.attach();
    this.mesh.getChildMeshes().forEach((m) => {
      m.setEnabled(true);
    });

    const combat = this.getComponent(CombatComponent) as CombatComponent;
    if (combat) {
      combat.getCurrentWeapon()?.show();
    }

    playerHealthStore.set(100);
    logger.info('Respawned');
  }

  /**
   * 완전한 상태 초기화 (사망 후 부활 시 사용)
   * - 위치/체력/충돌 복구 (respawn)
   * - 인벤토리 초기화
   * - 무기/탄약 초기화
   */
  public fullReset(position: Vector3): void {
    // 1. 기본 부활 (위치, 시체 제거, 물리)
    this.respawn(position);

    // 2. 인벤토리 비우기
    const { InventoryManager } = require('./inventory/InventoryManager'); // 순환 참조 방지 (지연 로딩)
    InventoryManager.clear();

    // 3. 전투 시스템 초기화 (무기 리셋 & 탄약 복구)
    const combat = this.getComponent(CombatComponent) as CombatComponent;
    if (combat) {
      combat.reset();
    }

    logger.info('Full Reset Complete');
  }
}
