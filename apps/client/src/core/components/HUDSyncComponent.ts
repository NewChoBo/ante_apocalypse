import { ammoStore } from '../store/GameStore';
import { IWeapon, IFirearm } from '../../types/IWeapon';

/**
 * 게임 상태(탄약 등)를 HUD UI(NanoStores)와 동기화하는 전용 컴포넌트.
 */
export class HUDSyncComponent {
  /** 탄약 정보 업데이트 */
  public syncAmmo(weapon: IWeapon): void {
    const isFirearm = (w: IWeapon): w is IFirearm =>
      (w as unknown as IFirearm).currentAmmo !== undefined;

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
}
