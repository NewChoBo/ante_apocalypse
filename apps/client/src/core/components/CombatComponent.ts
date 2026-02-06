import { Scene } from '@babylonjs/core';
import { BaseComponent } from './BaseComponent';
import { WeaponInventoryComponent } from './WeaponInventoryComponent';
import { IWeapon } from '../../types/IWeapon';
import { WeaponInputComponent } from './WeaponInputComponent';
import { HUDSyncComponent } from './HUDSyncComponent';
import { FirearmEffectComponent } from './FirearmEffectComponent';
import { MeleeEffectComponent } from './MeleeEffectComponent';
import { ImpactEffectComponent } from './ImpactEffectComponent';
import { CameraComponent } from './CameraComponent';
import type { BasePawn } from '../BasePawn';
import type { GameContext } from '../../types/GameContext';

/**
 * 캐릭터의 무기 인벤토리, 입력, UI 동기화를 조율하는 컴포넌트.
 */
export class CombatComponent extends BaseComponent {
  private inventory: WeaponInventoryComponent;
  private input: WeaponInputComponent;
  private hudSync: HUDSyncComponent;

  constructor(owner: BasePawn, scene: Scene, context: GameContext) {
    super(owner, scene);

    const cameraComp = owner.getComponent(CameraComponent) as CameraComponent;
    if (!cameraComp) {
      throw new Error('CombatComponent requires a CameraComponent on the Pawn');
    }

    this.hudSync = new HUDSyncComponent();

    // 1. 인벤토리 초기화
    this.inventory = new WeaponInventoryComponent(context, (force) =>
      cameraComp.applyRecoil(force)
    );

    // 무기 변경 시 HUD 동기화 리스너 등록
    this.inventory.onWeaponChanged.add((newWeapon) => this.hudSync.syncAmmo(newWeapon));

    // 2. 입력 처리 초기화
    this.input = new WeaponInputComponent(this.inventory, owner);

    // 초기 HUD 동기화
    this.hudSync.syncAmmo(this.inventory.currentWeapon);

    // 이펙트 컴포넌트 초기화
    // 이펙트 컴포넌트 초기화 및 등록
    this.attachEffect(FirearmEffectComponent);
    this.attachEffect(MeleeEffectComponent);
    this.attachEffect(ImpactEffectComponent);
  }

  private attachEffect<T extends BaseComponent>(
    componentClass: new (owner: BasePawn, scene: Scene) => T
  ): T {
    const comp = new componentClass(this.owner as BasePawn, this.scene);
    this.owner.addComponent(comp);
    return comp;
  }

  public setAiming(isAiming: boolean): void {
    if (this.owner.isDead) return;
    this.input.setAiming(isAiming);
  }

  public update(deltaTime: number): void {
    if (this.owner.isDead) return;
    this.inventory.update(deltaTime);
  }

  public getCurrentWeapon(): IWeapon | null {
    return this.inventory.currentWeapon;
  }

  public getWeapons(): IWeapon[] {
    return this.inventory.getWeapons();
  }

  public async equipWeapon(id: string): Promise<void> {
    await this.inventory.equipWeaponById(id);
  }

  public onWeaponChanged(callback: (weapon: IWeapon) => void): void {
    this.inventory.onWeaponChanged.add(callback);
  }

  public addAmmoToAll(amount: number): void {
    this.inventory.addAmmoToAll(amount);
  }

  public reset(): void {
    this.inventory.reset();
  }

  public dispose(): void {
    super.dispose();
    this.inventory.dispose();
    this.input.dispose();
  }
}
