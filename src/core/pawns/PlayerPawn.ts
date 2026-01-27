import { Mesh, Scene, UniversalCamera, Vector3 } from '@babylonjs/core';
import { BasePawn } from './BasePawn';
import { CharacterMovementComponent } from '../components/movement/CharacterMovementComponent';
import { CameraComponent } from '../components/movement/CameraComponent';
import { CombatComponent } from '../components/combat/CombatComponent';
import { InputComponent } from '../components/input/InputComponent';
import { playerHealthStore } from '../store/GameStore';
import { GameObservables } from '../events/GameObservables';
import playerData from '@/assets/data/characters/player_default.json';

/**
 * 1인칭 플레이어 캐릭터 실체 (Pawn).
 */
export class PlayerPawn extends BasePawn {
  public mesh: Mesh;
  public type = 'player';
  private movementComponent: CharacterMovementComponent;
  private cameraComponent: CameraComponent;
  private inputComponent: InputComponent | null = null;

  constructor(scene: Scene) {
    super(scene);
    this.id = 'player_local'; // Local player ID

    // Load stats from JSON
    this.health = playerData.health;
    this.maxHealth = playerData.maxHealth;
    this.damageProfile = playerData.damageProfile as any;

    // 초기 체력 동기화
    playerHealthStore.set(this.health);

    // 단순한 히트박스 또는 투명 메쉬 (Pawn의 실체)
    this.mesh = Mesh.CreateBox('playerPawn', 0.5, scene);
    this.mesh.isVisible = false; // 1인칭에서는 자신의 몸이 안보이게 함

    // Set initial position from data
    this.mesh.position.set(
      playerData.initialPosition.x,
      playerData.initialPosition.y,
      playerData.initialPosition.z
    );

    // 물리 충돌 설정
    this.mesh.checkCollisions = true;
    this.mesh.ellipsoid = new Vector3(0.4, 0.875, 0.4); // 캐릭터의 충돌 볼륨 (높이 1.75m)
    this.mesh.ellipsoidOffset = new Vector3(0, -0.875, 0); // 메쉬(눈높이)가 상단에 위치하도록 오프셋 설정

    // 카메라 컴포넌트 추가
    this.cameraComponent = new CameraComponent(this, scene, 0);
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

  public setupInput(enabled: boolean): void {
    if (enabled) {
      if (!this.inputComponent) {
        this.inputComponent = new InputComponent(this, this.scene);
        this.addComponent(this.inputComponent);
        console.log(`[PlayerPawn] InputComponent attached.`);
      }
    } else {
      if (this.inputComponent) {
        this.removeComponent(this.inputComponent);
        this.inputComponent = null;
        console.log(`[PlayerPawn] InputComponent detached.`);
      }
    }
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

    if (this.health <= 0) {
      this.die();
    }
  }

  public addHealth(amount: number): void {
    if (this.health <= 0) return;
    this.health = Math.min(this.maxHealth, this.health + amount);
    playerHealthStore.set(this.health);
  }

  public addAmmo(amount: number): void {
    const combatComp = this.getComponent(CombatComponent);
    if (combatComp instanceof CombatComponent) {
      combatComp.addAmmoToAll(amount);
    }
  }

  public die(): void {
    this.isDead = true;
    // Notify observers with this instance
    GameObservables.playerDied.notifyObservers(this);
  }
}
