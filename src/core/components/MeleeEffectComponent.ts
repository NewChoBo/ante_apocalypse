import { Scene, Mesh, Observer } from '@babylonjs/core';
import { BaseWeaponEffectComponent } from './BaseWeaponEffectComponent';
import { AssetLoader } from '../AssetLoader';
import { GameObservables } from '../events/GameObservables';
import type { IPawn } from '../../types/IPawn';

/**
 * 근접 무기 전용 시각적 피드백 컴포넌트.
 * 휘두르기 소리(Swipe Sound)를 전담합니다.
 */
export class MeleeEffectComponent extends BaseWeaponEffectComponent {
  public name = 'MeleeEffect';
  private swipeSound: any;
  private swipeObserver: Observer<any> | null = null;

  constructor(owner: IPawn, scene: Scene) {
    super(owner, scene);

    this.swipeSound = AssetLoader.getInstance().getSound('swipe');
  }

  public attach(target: Mesh): void {
    super.attach(target);
    // 이벤트 구독: 'melee' 타입인 경우에만 휘두르기 소리 발생
    this.swipeObserver = GameObservables.weaponFire.add((payload) => {
      if (payload.fireType === 'melee') {
        this.playSwipe();
      }
    });
  }

  public detach(): void {
    if (this.swipeObserver) {
      GameObservables.weaponFire.remove(this.swipeObserver);
      this.swipeObserver = null;
    }
    super.detach();
  }

  private playSwipe(): void {
    const sound = this.swipeSound || AssetLoader.getInstance().getSound('swipe');
    if (sound) {
      this.swipeSound = sound;
      sound.play();
    }
  }

  public dispose(): void {
    super.dispose();
    // 사운드 리소스는 AssetLoader가 관리하므로 별도 dispose 불요
  }
}
