import { WeaponInventoryComponent } from './WeaponInventoryComponent';

/**
 * 사용자 입력을 캡처하여 무기 인벤토리 및 현재 무기 행동으로 변환하는 컴포넌트.
 */
export class WeaponInputComponent {
  private inventory: WeaponInventoryComponent;

  constructor(inventory: WeaponInventoryComponent) {
    this.inventory = inventory;
    this.setupInputEvents();
  }

  private setupInputEvents(): void {
    // 마우스 이벤트 (발사)
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0 && document.pointerLockElement) {
        this.inventory.currentWeapon.startFire();
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.inventory.currentWeapon.stopFire();
      }
    });

    // 키보드 이벤트 (교체 및 재장전)
    document.addEventListener('keydown', (e) => {
      switch (e.code) {
        case 'Digit1':
          this.inventory.switchWeapon(0);
          break;
        case 'Digit2':
          this.inventory.switchWeapon(1);
          break;
        case 'Digit3':
          this.inventory.switchWeapon(2);
          break;
        case 'Digit4':
          this.inventory.switchWeapon(3);
          break;
        case 'KeyR':
          const weapon = this.inventory.currentWeapon;
          const firearm = weapon as any;
          if (firearm.reload && typeof firearm.reload === 'function') {
            firearm.reload();
          }
          break;
      }
    });
  }

  /** Pawn의 handleInput에서 호출될 조준 처리 */
  public setAiming(isAiming: boolean): void {
    this.inventory.currentWeapon.setAiming(isAiming);
  }
}
