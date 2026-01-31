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

  // Reference speeds for animation scaling (units/sec)
  // Lower values make animations play faster for the same movement speed
  private readonly WALK_REF_SPEED = 3.0; // Decreased from 4.0
  private readonly RUN_REF_SPEED = 6.0; // Decreased from 8.0
  private readonly ANIM_SPEED_MULTIPLIER = 1.3; // Adjusted from 1.5

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
  public playAnimation(name: AnimState, speedRatio: number = 1.0): void {
    if (!this.skeleton) return;

    // speedRatio가 변했을 경우에도 갱신이 필요하므로 currentAnim만으로 리턴하지 않음
    if (this.currentAnim === name) {
      const anims = this.scene.animatables.filter((a) => a.target === this.skeleton);
      anims.forEach((a) => {
        a.speedRatio = name === 'walk_back' ? -speedRatio : speedRatio;
      });
      return;
    }

    const range = this.ranges.get(name);
    if (range) {
      const finalSpeedRatio = name === 'walk_back' ? -speedRatio : speedRatio;
      this.scene.beginAnimation(this.skeleton, range.from, range.to, true, finalSpeedRatio);
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

    // 3. Select animation and calculate speed ratio based on dominant direction
    let targetAnim: AnimState = 'idle';
    let targetSpeedRatio = 1.0;

    if (Math.abs(vz) >= Math.abs(vx) * 0.8) {
      if (vz > 0.1) {
        if (speed > 6.5) {
          targetAnim = 'run';
          targetSpeedRatio = speed / this.RUN_REF_SPEED;
        } else {
          targetAnim = 'walk';
          targetSpeedRatio = speed / this.WALK_REF_SPEED;
        }
      } else if (vz < -0.1) {
        targetAnim = 'walk_back';
        targetSpeedRatio = speed / this.WALK_REF_SPEED;
      } else {
        targetAnim = 'idle';
      }
    } else {
      targetSpeedRatio = speed / this.WALK_REF_SPEED;
      if (vx > 0.1) {
        targetAnim = 'strafe_right';
      } else if (vx < -0.1) {
        targetAnim = 'strafe_left';
      } else {
        targetAnim = 'idle';
      }
    }

    // Clamp speed ratio to reasonable limits
    targetSpeedRatio *= this.ANIM_SPEED_MULTIPLIER;
    targetSpeedRatio = Math.max(0.5, Math.min(4.0, targetSpeedRatio));

    if (targetAnim === 'idle') {
      this.playAnimation('idle', this.ANIM_SPEED_MULTIPLIER);
    } else {
      this.playAnimation(targetAnim, targetSpeedRatio);
    }
  }

  /**
   * 스켈레톤 조회
   */
  public getSkeleton(): Skeleton | null {
    return this.skeleton;
  }
}
