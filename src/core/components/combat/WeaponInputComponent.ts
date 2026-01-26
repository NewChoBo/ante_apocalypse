import { Mesh } from '@babylonjs/core';
import { BaseComponent } from '@/core/components/base/BaseComponent';
import { WeaponInventoryComponent } from './WeaponInventoryComponent';
import { Scene } from '@babylonjs/core';
import type { IPawn } from '../../../types/IPawn';

/**
 * 사용자 입력을 캡처하여 무기 인벤토리 및 현재 무기 행동으로 변환하는 컴포넌트.
 */
export class WeaponInputComponent extends BaseComponent {
  public name = 'WeaponInput';
  private inventory: WeaponInventoryComponent | null = null;

  constructor(owner: IPawn, scene: Scene) {
    super(owner, scene);
  }

  public attach(target: Mesh): void {
    super.attach(target);
    this.inventory = this.owner.getComponent(WeaponInventoryComponent) || null;
    this.setupInputEvents();
  }

  public detach(): void {
    this.removeInputEvents();
    this.inventory = null;
    super.detach();
  }

  public update(_deltaTime: number): void {
    // 입력은 이벤트 기반으로 처리
  }

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0 && document.pointerLockElement && this.inventory) {
      this.inventory.currentWeapon.startFire();
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0 && this.inventory) {
      this.inventory.currentWeapon.stopFire();
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    // 포인터가 잠겨있을 때만 무기 조작 허용
    if (!document.pointerLockElement) return;

    switch (e.code) {
      case 'Digit1':
        this.inventory?.switchWeaponBySlot(0);
        break;
      case 'Digit2':
        this.inventory?.switchWeaponBySlot(1);
        break;
      case 'Digit3':
        this.inventory?.switchWeaponBySlot(2);
        break;
      case 'Digit4':
        this.inventory?.switchWeaponBySlot(3);
        break;
      case 'KeyR': {
        const weapon = this.inventory?.currentWeapon;
        const firearm = weapon as { reload?(): void };
        if (firearm && firearm.reload && typeof firearm.reload === 'function') {
          firearm.reload();
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
    if (this.inventory) {
      this.inventory.currentWeapon.setAiming(isAiming);
    }
  }

  private removeInputEvents(): void {
    document.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('keydown', this.onKeyDown);
  }

  public dispose(): void {
    this.detach();
    super.dispose();
  }
}
