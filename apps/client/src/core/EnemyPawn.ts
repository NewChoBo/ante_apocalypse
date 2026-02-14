import { Vector3, Scene, ShadowGenerator } from '@babylonjs/core';
import { CharacterPawn, CharacterPawnConfig } from './CharacterPawn';
import { IEnemyPawn } from '@ante/game-core';
import { NetworkInterpolationComponent } from './components/movement/NetworkInterpolationComponent';
import type { GameContext } from '../types/GameContext';

/**
 * 적 Pawn - CharacterPawn 상속
 *
 * 추가 컴포넌트:
 * - NetworkInterpolationComponent: 네트워크 위치/회전 보간
 *
 * AI는 외부 AIController에서 제어
 */
export class EnemyPawn extends CharacterPawn implements IEnemyPawn {
  public type = 'enemy';

  private interpolation: NetworkInterpolationComponent;

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

    this.interpolation = new NetworkInterpolationComponent(this);
    this.addComponent(this.interpolation);
  }

  public initialize(_scene: Scene): void {
    // Required by IEnemyPawn interface
  }

  public override tick(deltaTime: number): void {
    super.tick(deltaTime);
    this.isMoving = this.interpolation.isMoving;
    this.animationComponent.setHeadPitch(this.interpolation.getTargetPitch());
  }

  public updateNetworkState(
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number }
  ): void {
    this.interpolation.updateTarget(position, rotation);
  }

  // Enemy-specific methods
  public lookAt(targetPoint: Vector3): void {
    this.mesh.lookAt(targetPoint);
  }

  public move(direction: Vector3, speed: number, deltaTime: number): void {
    this.mesh.moveWithCollisions(direction.scale(speed * deltaTime));
    this.isMoving = true;
  }
}

