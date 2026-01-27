import { Mesh, Scene } from '@babylonjs/core';
import { BaseComponent } from '@/core/components/base/BaseComponent';
import { WeaponInventoryComponent } from './WeaponInventoryComponent';
import { CombatComponent } from './CombatComponent';
import { InputComponent } from '../input/InputComponent';
import type { IPawn } from '../../../types/IPawn';
import { InputAction } from '../../../types/InputTypes';

/**
 * 사용자 입력을 캡처하여 무기 인벤토리 및 현재 무기 행동으로 변환하는 컴포넌트.
 * InputComponent를 통해 입력을 받아 처리합니다.
 */
export class WeaponInputComponent extends BaseComponent {
  public name = 'WeaponInput';
  private combatComp: CombatComponent | null = null;
  private inventory: WeaponInventoryComponent | null = null;

  constructor(owner: IPawn, scene: Scene) {
    super(owner, scene);
  }

  public attach(target: Mesh): void {
    super.attach(target);
    this.combatComp = this.owner.getComponent(CombatComponent) || null;
    this.inventory = this.owner.getComponent(WeaponInventoryComponent) || null;
  }

  public detach(): void {
    this.inventory = null;
    super.detach();
  }

  public update(_deltaTime: number): void {
    if (!this.inventory) return;

    const inputComp = this.owner.getComponent(InputComponent);
    if (!inputComp) return;

    // 1. 발사 처리 (Fire)
    if (inputComp.state[InputAction.FIRE]) {
      this.combatComp?.startFire();
    } else {
      this.combatComp?.stopFire();
    }

    // 2. 조준 처리 (Aim)
    this.inventory.currentWeapon.setAiming(inputComp.state[InputAction.AIM]);

    // 3. 재장전 (Reload) - Edge detection
    if (inputComp.isButtonDown(InputAction.RELOAD)) {
      this.combatComp?.reload();
    }

    // 4. 무기 교체 (Slots)
    if (inputComp.isButtonDown(InputAction.SLOT_1)) this.inventory.switchWeaponBySlot(0);
    if (inputComp.isButtonDown(InputAction.SLOT_2)) this.inventory.switchWeaponBySlot(1);
    if (inputComp.isButtonDown(InputAction.SLOT_3)) this.inventory.switchWeaponBySlot(2);
    if (inputComp.isButtonDown(InputAction.SLOT_4)) this.inventory.switchWeaponBySlot(3);
  }
}
