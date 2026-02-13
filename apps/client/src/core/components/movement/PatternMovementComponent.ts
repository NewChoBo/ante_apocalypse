import { BaseComponent } from '@ante/game-core';
import { TargetPawn } from '../../TargetPawn';
import { Scene, Vector3 } from '@babylonjs/core';
import type { GameContext } from '../../../types/GameContext';

export interface MovementConfig {
  pattern: 'sine_x' | 'sine_y' | 'linear';
  range: number;
  speed: number;
}

export class PatternMovementComponent extends BaseComponent {
  private targetOwner: TargetPawn;
  private config: MovementConfig;
  private baseLocalPosition: Vector3;
  private ctx: GameContext;

  constructor(owner: TargetPawn, scene: Scene, context: GameContext, config: MovementConfig) {
    super(owner, scene);
    this.targetOwner = owner;
    this.ctx = context;
    this.config = config;

    // 메쉬의 초기 로컬 포지션 기준 (TargetPawn.mesh는 루트)
    // 움직이는 타겟의 경우 MeshComponent가 만든 visualMesh가 움직이는게 아니라
    // TargetPawn의 Root Mesh 자체가 움직이거나, Visual Mesh가 움직여야 함.
    // 기존 MovingTarget은 mesh.position.x를 움직였음.
    // TargetPawn Root는 고정(스폰 위치)이고 내부 Visual만 움직일지, Root가 움직일지 결정 필요.
    // 여기서는 Root Mesh(owner.mesh)를 움직이는 것으로 처리.
    // 그러나 spawnTarget에서 position을 설정하므로, base는 현재 위치가 됨.
    this.baseLocalPosition = this.targetOwner.mesh.position.clone();
  }

  public update(_deltaTime: number): void {
    const serverTime = this.ctx.networkManager.getServerTime();

    if (this.config.pattern === 'sine_x') {
      const phase = serverTime * this.config.speed;
      const offset = Math.sin(phase) * this.config.range;

      // X축 기준 이동
      this.targetOwner.mesh.position.x = this.baseLocalPosition.x + offset;
    }
  }
}

