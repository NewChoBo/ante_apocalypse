import { Scene, Sound } from '@babylonjs/core';
import { BaseWeaponEffectComponent } from './BaseWeaponEffectComponent';
import { GameAssets } from '../GameAssets';
import { GameObservables } from '../events/GameObservables';

import type { BasePawn } from '../BasePawn';

/**
 * 근접 무기 전용 시각적 피드백 컴포넌트.
 * 휘두르기 소리(Swipe Sound)를 전담합니다.
 */
export class MeleeEffectComponent extends BaseWeaponEffectComponent {
  private swipeSound: Sound | null = null;

  constructor(owner: BasePawn, scene: Scene) {
    super(owner, scene);

    this.swipeSound = GameAssets.sounds.swipe;

    // Event subscription: Play swipe sound only for 'melee' type weapon fire
    GameObservables.weaponFire.add((payload): void => {
      if (payload.fireType === 'melee') {
        this.playSwipe();
      }
    });
  }

  private playSwipe(): void {
    const sound = this.swipeSound || GameAssets.sounds.swipe;
    if (sound) {
      this.swipeSound = sound;
      sound.play();
    }
  }

  public dispose(): void {
    super.dispose();
    // 사운드 리소스는 AudioManager가 관리하므로 별도 dispose 불요
  }
}
