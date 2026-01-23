import { ammoStore, scoreStore } from '../store/GameStore';
import { IWeapon, IFirearm } from '../../types/IWeapon';

/**
 * 게임 상태(탄약, 점수 등)를 HUD UI(NanoStores)와 동기화하는 전용 컴포넌트.
 */
export class HUDSyncComponent {
  private currentScore = 0;

  /** 탄약 정보 업데이트 */
  public syncAmmo(weapon: IWeapon): void {
    const isFirearm = (w: any): w is IFirearm => w.currentAmmo !== undefined;

    if (isFirearm(weapon)) {
      ammoStore.set({
        weaponName: weapon.name,
        current: weapon.currentAmmo,
        reserve: weapon.reserveAmmo,
        showAmmo: true,
      });
    } else {
      ammoStore.set({
        weaponName: weapon.name,
        current: 0,
        reserve: 0,
        showAmmo: false,
      });
    }
  }

  /** 점수 업데이트 */
  public updateScore(points: number): void {
    this.currentScore += points;
    scoreStore.set(this.currentScore);
  }

  /** 강제 점수 동기화 */
  public syncScore(score: number): void {
    this.currentScore = score;
    scoreStore.set(this.currentScore);
  }
}
