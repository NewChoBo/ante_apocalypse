import { Scene, Skeleton, AnimationPropertiesOverride, Bone, Vector3 } from '@babylonjs/core';
import { BaseComponent } from './BaseComponent';
import { BasePawn } from '../BasePawn';

interface AnimationRange {
  from: number;
  to: number;
}

type AnimState = 'idle' | 'walk' | 'walk_back' | 'run' | 'strafe_left' | 'strafe_right' | 'none';

/**
 * 스켈레톤 애니메이션 상태 관리를 담당하는 컴포넌트
 */
export class SkeletonAnimationComponent extends BaseComponent {
  private skeleton: Skeleton | null = null;
  private ranges: Map<AnimState, AnimationRange> = new Map();
  private currentAnim: AnimState = 'none';
  private headBoneNode: Bone | null = null;

  constructor(owner: BasePawn, scene: Scene) {
    super(owner, scene);
  }

  private smoothedVelocity: Vector3 = new Vector3();
  private readonly LERP_FACTOR = 0.15; // Low-pass filter factor
  private readonly MOVE_THRESHOLD_ENTER = 0.2; // Speed to enter move state
  private readonly MOVE_THRESHOLD_EXIT = 0.05; // Speed to exit move state

  /**
   * 스케레톤과 애니메이션 범위 초기화
   */
  public initializeSkeleton(skeleton: Skeleton): void {
    this.skeleton = skeleton;

    // Animation blending setup
    skeleton.animationPropertiesOverride = new AnimationPropertiesOverride();
    skeleton.animationPropertiesOverride.enableBlending = true;
    skeleton.animationPropertiesOverride.blendingSpeed = 0.15; // Slightly faster blending for responsiveness

    // Define standard ranges for YBot
    const rangesToDefine: Record<string, [number, number]> = {
      YBot_Idle: [0, 89],
      YBot_Walk: [90, 118],
      YBot_Run: [119, 135],
      YBot_LeftStrafeWalk: [136, 163],
      YBot_RightStrafeWalk: [164, 191],
    };

    for (const [name, [from, to]] of Object.entries(rangesToDefine)) {
      if (!skeleton.getAnimationRange(name)) {
        skeleton.createAnimationRange(name, from, to);
      }
    }

    this.ranges.set('idle', skeleton.getAnimationRange('YBot_Idle') as AnimationRange);
    this.ranges.set('walk', skeleton.getAnimationRange('YBot_Walk') as AnimationRange);
    this.ranges.set('run', skeleton.getAnimationRange('YBot_Run') as AnimationRange);
    this.ranges.set(
      'strafe_left',
      skeleton.getAnimationRange('YBot_LeftStrafeWalk') as AnimationRange
    );
    this.ranges.set(
      'strafe_right',
      skeleton.getAnimationRange('YBot_RightStrafeWalk') as AnimationRange
    );
    // Backward walk usually uses reversed forward walk
    this.ranges.set('walk_back', skeleton.getAnimationRange('YBot_Walk') as AnimationRange);

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
  public playAnimation(name: AnimState): void {
    if (!this.skeleton || this.currentAnim === name) return;

    const range = this.ranges.get(name);
    if (range) {
      const speedRatio = name === 'walk_back' ? -1.0 : 1.0;
      this.scene.beginAnimation(this.skeleton, range.from, range.to, true, speedRatio);
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
   * 매 프레임 업데이트
   */
  public update(_deltaTime: number): void {
    // 외부에서 속도 정보와 함께 호출됨
  }

  /**
   * 움직임 상태에 따른 애니메이션 업데이트 (Legacy support)
   */
  public updateByMovementState(isMoving: boolean): void {
    if (isMoving) {
      if (this.currentAnim === 'idle' || this.currentAnim === 'none') {
        this.playAnimation('walk');
      }
    } else {
      this.playAnimation('idle');
    }
  }

  /**
   * 위치 변화량(속도)에 기반한 방향성 애니메이션 업데이트
   */
  public updateAnimationByVelocity(velocity: Vector3): void {
    if (!this.skeleton) return;

    // 1. Smooth the input velocity using LERP (Low-pass filter)
    Vector3.LerpToRef(this.smoothedVelocity, velocity, this.LERP_FACTOR, this.smoothedVelocity);

    const speed = this.smoothedVelocity.length();

    // 2. Hysteresis for Idle/Move transition
    const isCurrentlyIdle = this.currentAnim === 'idle' || this.currentAnim === 'none';
    const threshold = isCurrentlyIdle ? this.MOVE_THRESHOLD_ENTER : this.MOVE_THRESHOLD_EXIT;

    if (speed < threshold) {
      this.playAnimation('idle');
      return;
    }

    // Transform smoothed world velocity to local space
    const mesh = (this.owner as any).mesh;
    if (!mesh) return;

    mesh.computeWorldMatrix(true);
    const worldMatrix = mesh.getWorldMatrix();
    const invWorldMatrix = worldMatrix.clone().invert();
    const localVelocity = Vector3.TransformNormal(this.smoothedVelocity, invWorldMatrix);

    // Analyze local velocity components
    const vz = localVelocity.z; // Forward/Backward
    const vx = localVelocity.x; // Left/Right

    // 3. Select animation based on dominant direction with small bias to prevent rapid switching
    if (Math.abs(vz) >= Math.abs(vx) * 0.8) {
      if (vz > 0.1) {
        this.playAnimation(speed > 6 ? 'run' : 'walk'); // Adjusted run speed threshold
      } else if (vz < -0.1) {
        this.playAnimation('walk_back');
      } else {
        // This case is largely covered by speed threshold, but for safety:
        this.playAnimation('idle');
      }
    } else {
      if (vx > 0.1) {
        this.playAnimation('strafe_right');
      } else if (vx < -0.1) {
        this.playAnimation('strafe_left');
      } else {
        this.playAnimation('idle');
      }
    }
  }

  /**
   * 스켈레톤 조회
   */
  public getSkeleton(): Skeleton | null {
    return this.skeleton;
  }
}
