import { WeaponInventoryComponent } from './WeaponInventoryComponent';
import type { BasePawn } from '../../BasePawn';

/**
 * 사용자 입력을 캡처하여 무기 인벤토리 및 현재 무기 행동으로 변환하는 컴포넌트.
 */
export class WeaponInputComponent {
  private inventory: WeaponInventoryComponent;
  private owner: BasePawn;

  constructor(inventory: WeaponInventoryComponent, owner: BasePawn) {
    this.inventory = inventory;
    this.owner = owner;
    this.setupInputEvents();
  }

  private onMouseDown = (e: MouseEvent): void => {
    if (this.owner.isDead) return;
    if (e.button === 0 && document.pointerLockElement) {
      this.inventory.currentWeapon.startFire();
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (this.owner.isDead) return;
    if (e.button === 0) {
      this.inventory.currentWeapon.stopFire();
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.owner.isDead) return;
    // 포인터가 잠겨있을 때만 무기 조작 허용
    if (!document.pointerLockElement) return;

    switch (e.code) {
      case 'Digit1':
        this.inventory.switchWeaponBySlot(0);
        break;
      case 'Digit2':
        this.inventory.switchWeaponBySlot(1);
        break;
      case 'Digit3':
        this.inventory.switchWeaponBySlot(2);
        break;
      case 'Digit4':
        this.inventory.switchWeaponBySlot(3);
        break;
      case 'KeyR': {
        const weapon = this.inventory.currentWeapon;
        if ('reload' in weapon && typeof (weapon as { reload: () => void }).reload === 'function') {
          (weapon as { reload: () => void }).reload();
        }
        break;
      }
    }
  };

  private setupInputEvents(): void {
    document.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('keydown', this.onKeyDown);
  }

  /** Pawn의 handleInput에서 호출될 조준 처리 */
  public setAiming(isAiming: boolean): void {
    this.inventory.currentWeapon.setAiming(isAiming);
  }

  public dispose(): void {
    document.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('keydown', this.onKeyDown);
  }
}

