import { Scene } from '@babylonjs/core';
import { BaseComponent } from './BaseComponent';
import { WeaponInventoryComponent } from './WeaponInventoryComponent';
import { WeaponInputComponent } from './WeaponInputComponent';
import { HUDSyncComponent } from './HUDSyncComponent';
import { FirearmEffectComponent } from './FirearmEffectComponent';
import { MeleeEffectComponent } from './MeleeEffectComponent';
import { ImpactEffectComponent } from './ImpactEffectComponent';
import { CameraComponent } from './CameraComponent';
import type { BasePawn } from '../BasePawn';

/**
 * 캐릭터의 무기 인벤토리, 입력, UI 동기화를 조율하는 컴포넌트.
 */
export class CombatComponent extends BaseComponent {
  private inventory: WeaponInventoryComponent;
  private input: WeaponInputComponent;
  private hudSync: HUDSyncComponent;

  constructor(owner: BasePawn, scene: Scene) {
    super(owner, scene);

    const cameraComp = owner.getComponent(CameraComponent);
    if (!cameraComp) {
      throw new Error('CombatComponent requires a CameraComponent on the Pawn');
    }

    this.hudSync = new HUDSyncComponent();

    // 1. 인벤토리 초기화 (점수 콜백을 hudSync에 연결)
    this.inventory = new WeaponInventoryComponent(
      scene,
      cameraComp.camera,
      (points) => this.hudSync.updateScore(points),
      (force) => cameraComp.applyRecoil(force),
      (newWeapon) => this.hudSync.syncAmmo(newWeapon)
    );

    // 2. 입력 처리 초기화
    this.input = new WeaponInputComponent(this.inventory);

    // 초기 HUD 동기화
    this.hudSync.syncAmmo(this.inventory.currentWeapon);

    // 이펙트 컴포넌트 초기화
    // 이펙트 컴포넌트 초기화 및 등록
    const fireEffect = new FirearmEffectComponent(owner, scene);
    owner.addComponent(fireEffect);

    const meleeEffect = new MeleeEffectComponent(owner, scene);
    owner.addComponent(meleeEffect);

    const impactEffect = new ImpactEffectComponent(owner, scene);
    owner.addComponent(impactEffect);
  }

  public setAiming(isAiming: boolean): void {
    this.input.setAiming(isAiming);
  }

  public update(deltaTime: number): void {
    this.inventory.update(deltaTime);
  }

  public getCurrentWeapon() {
    return this.inventory.currentWeapon;
  }

  public dispose(): void {
    super.dispose();
    this.inventory.dispose();
    this.input.dispose();
  }
}
