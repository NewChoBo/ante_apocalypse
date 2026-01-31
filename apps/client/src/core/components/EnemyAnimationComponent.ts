import { Scene, Skeleton } from '@babylonjs/core';
import { BaseComponent, IPawnCore } from '@ante/game-core';

interface AnimationOwner extends IPawnCore {
  isMoving: boolean;
}

/**
 * 적의 애니메이션 상태 전환을 담당하는 컴포넌트
 */
export class EnemyAnimationComponent extends BaseComponent {
  private animOwner: AnimationOwner;
  private skeleton: Skeleton | null = null;
  private currentAnim: 'idle' | 'walk' = 'idle';

  // Animation ranges
  private idleRange: { from: number; to: number } | null = null;
  private walkRange: { from: number; to: number } | null = null;

  constructor(owner: AnimationOwner, scene: Scene) {
    super(owner, scene);
    this.animOwner = owner;
  }

  /**
   * 스켈레톤 설정 및 애니메이션 범위 초기화
   */
  public setSkeleton(skeleton: Skeleton): void {
    this.skeleton = skeleton;

    this.idleRange = this.skeleton.getAnimationRange('YBot_Idle');
    this.walkRange = this.skeleton.getAnimationRange('YBot_Walk');

    // Start with idle
    if (this.idleRange) {
      this.scene.beginAnimation(this.skeleton, this.idleRange.from, this.idleRange.to, true);
      this.currentAnim = 'idle';
    }
  }

  /**
   * 이동 상태에 따라 애니메이션 전환
   */
  public update(_deltaTime: number): void {
    if (!this.skeleton || !this.idleRange || !this.walkRange) return;

    if (this.animOwner.isMoving) {
      if (this.currentAnim !== 'walk') {
        this.scene.beginAnimation(this.skeleton, this.walkRange.from, this.walkRange.to, true);
        this.currentAnim = 'walk';
      }
    } else {
      if (this.currentAnim !== 'idle') {
        this.scene.beginAnimation(this.skeleton, this.idleRange.from, this.idleRange.to, true);
        this.currentAnim = 'idle';
      }
    }
  }

  public getCurrentAnimation(): 'idle' | 'walk' {
    return this.currentAnim;
  }
}
