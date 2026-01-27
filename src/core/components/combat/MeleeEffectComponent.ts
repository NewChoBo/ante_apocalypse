import { Scene, Mesh, Observer, Sound } from '@babylonjs/core';
import { BaseWeaponEffectComponent } from './BaseWeaponEffectComponent';
import { AssetLoader } from '../../loaders/AssetLoader';
import { NetworkMediator } from '../../network/NetworkMediator';
import { NetworkManager } from '../../network/NetworkManager';
import { CombatComponent } from './CombatComponent';
import type { IPawn } from '../../../types/IPawn';
import { IWeapon } from '../../../types/IWeapon';

/**
 * 근접 무기 전용 시각적 피드백 컴포넌트.
 * 휘두르기 소리(Swipe Sound)를 전담합니다.
 */
export class MeleeEffectComponent extends BaseWeaponEffectComponent {
  public name = 'MeleeEffect';
  private swipeSound: Sound | null = null;
  // Observers
  private networkObserver: Observer<any> | null = null;
  private weaponObserver: Observer<IWeapon> | null = null;
  private weaponChangeObserver: Observer<IWeapon> | null = null;

  constructor(owner: IPawn, scene: Scene) {
    super(owner, scene);

    this.swipeSound = AssetLoader.getInstance().getSound('swipe');
  }

  public attach(target: Mesh): void {
    super.attach(target);

    // 1. Remote Events (via NetworkMediator)
    this.networkObserver = NetworkMediator.getInstance().onFired.add((payload) => {
      if (payload.shooterId === this.owner.id && this.isLocalPlayer()) return;

      // 만약 발사된 무기가 근접 무기라면 소리 재생
      // (현 구조상 ON_FIRED는 모든 발사를 포함하므로 weaponId로 분류 필요)
      if (payload.weaponId === 'Knife' || payload.weaponId === 'Bat') {
        this.playSwipe();
      }
    });

    // 2. Local Prediction (via CombatComponent)
    if (this.isLocalPlayer()) {
      const combat = this.owner.getComponent(CombatComponent);
      if (combat) {
        this.bindWeapon(combat.getCurrentWeapon());

        this.weaponChangeObserver = combat.onWeaponChanged.add((newWeapon: IWeapon) => {
          this.bindWeapon(newWeapon);
        });
      }
    }
  }

  private isLocalPlayer(): boolean {
    const myId = NetworkManager.getInstance().getSocketId();
    return this.owner.id === myId;
  }

  private bindWeapon(weapon: IWeapon): void {
    if (!weapon || !weapon.onFirePredicted) return;

    // 기존 구독 해제
    if (this.weaponObserver) {
      weapon.onFirePredicted.remove(this.weaponObserver);
    }

    if (weapon.name === 'Knife' || weapon.name === 'Bat') {
      this.weaponObserver = weapon.onFirePredicted.add(() => {
        this.playSwipe();
      });
    }
  }

  public detach(): void {
    if (this.networkObserver) {
      NetworkMediator.getInstance().onFired.remove(this.networkObserver);
      this.networkObserver = null;
    }

    if (this.weaponObserver && (this.owner as any).getComponent(CombatComponent)) {
      const combat = this.owner.getComponent(CombatComponent);
      const currentWeapon = combat?.getCurrentWeapon();
      if (currentWeapon?.onFirePredicted) {
        currentWeapon.onFirePredicted.remove(this.weaponObserver);
      }
      this.weaponObserver = null;
    }

    if (this.weaponChangeObserver) {
      const combat = this.owner.getComponent(CombatComponent);
      combat?.onWeaponChanged.remove(this.weaponChangeObserver);
      this.weaponChangeObserver = null;
    }

    super.detach();
  }

  private playSwipe(): void {
    const sound = this.swipeSound || AssetLoader.getInstance().getSound('swipe') || null;
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
