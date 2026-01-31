import { Scene, Skeleton, AnimationPropertiesOverride, Bone } from '@babylonjs/core';
import { BaseComponent } from './BaseComponent';
import { BasePawn } from '../BasePawn';

interface AnimationRange {
  from: number;
  to: number;
}

/**
 * 스켈레톤 애니메이션 상태 관리를 담당하는 컴포넌트
 * RemotePlayerPawn에서 분리됨
 */
export class SkeletonAnimationComponent extends BaseComponent {
  private skeleton: Skeleton | null = null;
  private idleRange: AnimationRange | null = null;
  private walkRange: AnimationRange | null = null;
  private currentAnim: 'idle' | 'walk' | 'none' = 'none';
  private headBoneNode: Bone | null = null;

  constructor(owner: BasePawn, scene: Scene) {
    super(owner, scene);
  }

  /**
   * 스켈레톤과 애니메이션 범위 초기화
   */
  public initializeSkeleton(skeleton: Skeleton): void {
    this.skeleton = skeleton;

    // Animation blending setup
    skeleton.animationPropertiesOverride = new AnimationPropertiesOverride();
    skeleton.animationPropertiesOverride.enableBlending = true;
    skeleton.animationPropertiesOverride.blendingSpeed = 0.1;

    // Find or create animation ranges
    this.idleRange = skeleton.getAnimationRange('YBot_Idle') as AnimationRange | null;
    if (!this.idleRange) {
      skeleton.createAnimationRange('YBot_Idle', 0, 89);
      skeleton.createAnimationRange('YBot_Walk', 90, 118);
      this.idleRange = skeleton.getAnimationRange('YBot_Idle') as AnimationRange | null;
    }
    this.walkRange = skeleton.getAnimationRange('YBot_Walk') as AnimationRange | null;

    // Find head bone for pitch rotation
    this.headBoneNode =
      skeleton.bones.find((b) => b.name.toLowerCase().includes('head')) ??
      skeleton.bones.find((b) => b.name.toLowerCase().includes('neck')) ??
      null;

    // Start with idle animation
    this.playAnimation('idle');
  }

  /**
   * 특정 애니메이션 재생
   */
  public playAnimation(name: 'idle' | 'walk'): void {
    if (!this.skeleton || this.currentAnim === name) return;

    const range = name === 'idle' ? this.idleRange : this.walkRange;
    if (range) {
      this.scene.beginAnimation(this.skeleton, range.from, range.to, true);
      this.currentAnim = name;
    }
  }

  /**
   * 애니메이션 정지
   */
  public stopAnimation(): void {
    if (this.skeleton) {
      this.scene.stopAnimation(this.skeleton);
      this.currentAnim = 'none';
    }
  }

  /**
   * 헤드 본 Pitch 회전 설정
   */
  public setHeadPitch(pitch: number): void {
    if (this.headBoneNode) {
      this.headBoneNode.rotation.x = pitch;
    }
  }

  /**
   * 매 프레임 업데이트 (움직임 상태에 따른 애니메이션 전환)
   */
  public update(_deltaTime: number): void {
    // 이 컴포넌트는 isMoving 정보가 필요하므로 외부에서 호출
  }

  /**
   * 움직임 상태에 따른 애니메이션 업데이트
   */
  public updateByMovementState(isMoving: boolean): void {
    if (isMoving) {
      this.playAnimation('walk');
    } else {
      this.playAnimation('idle');
    }
  }

  /**
   * 스켈레톤 조회
   */
  public getSkeleton(): Skeleton | null {
    return this.skeleton;
  }
}
