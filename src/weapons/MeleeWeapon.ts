import { Scene, UniversalCamera } from '@babylonjs/core';
import { BaseWeapon } from './BaseWeapon.ts';
import { TargetManager } from '../targets/TargetManager.ts';

/**
 * 근접 무기(Melee Weapons)를 위한 중간 추상 클래스.
 * 휘두르기 로직, 스테미너 소모, 충돌 판정 등을 구현할 예정입니다.
 */
export abstract class MeleeWeapon extends BaseWeapon {
  protected isSwinging = false;
  protected lastSwingTime = 0;

  constructor(
    scene: Scene,
    camera: UniversalCamera,
    targetManager: TargetManager,
    onScore?: (points: number) => void
  ) {
    super(scene, camera, targetManager, onScore);
  }

  /** 근접 무기 사용 */
  public fire(): boolean {
    return this.swing();
  }

  public abstract swing(): boolean;

  public startFire(): void {
    this.fire();
  }

  public stopFire(): void {
    // 근접 무기는 보통 단발적임
  }

  public reload(): void {
    // 근접 무기는 재장전이 없음
  }

  public getStats(): Record<string, unknown> {
    return {
      name: this.name,
      damage: this.damage,
      range: this.range,
    };
  }

  public update(_deltaTime: number): void {
    // 애니메이션 업데이트 등
  }
}
