import { Vector3, Scene, ShadowGenerator } from '@babylonjs/core';
import { CharacterPawn, CharacterPawnConfig } from './CharacterPawn';
import { IEnemyPawn } from '@ante/game-core';
import { EnemyMovementComponent } from './components/EnemyMovementComponent';
import type { GameContext } from '../types/GameContext';

/**
 * 적 Pawn - CharacterPawn 상속
 *
 * 추가 컴포넌트:
 * - EnemyMovementComponent: 이동, 중력 처리
 *
 * AI는 외부 AIController에서 제어
 */
export class EnemyPawn extends CharacterPawn implements IEnemyPawn {
  public type = 'enemy';

  // Enemy-specific components
  private movementComponent: EnemyMovementComponent;

  constructor(
    scene: Scene,
    position: Vector3,
    shadowGenerator: ShadowGenerator,
    context: GameContext
  ) {
    const config: CharacterPawnConfig = {
      assetKey: 'enemy',
      type: 'enemy',
      position,
      shadowGenerator,
      healthBarStyle: 'enemy',
      showHealthBar: true,
    };
    super(scene, config, context);

    // Enemy-specific: movement with gravity
    this.movementComponent = new EnemyMovementComponent(this, scene);
    this.addComponent(this.movementComponent);
  }

  public initialize(_scene: Scene): void {
    // Required by IEnemyPawn interface
  }

  public override tick(deltaTime: number): void {
    super.tick(deltaTime);
  }

  // Enemy-specific methods
  public lookAt(targetPoint: Vector3): void {
    this.movementComponent.lookAt(targetPoint);
  }

  public move(direction: Vector3, speed: number, deltaTime: number): void {
    this.movementComponent.move(direction, speed, deltaTime);
  }
}
