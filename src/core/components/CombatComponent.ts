import { Scene } from '@babylonjs/core';
import { BaseComponent } from './BaseComponent';
import { WeaponSystem } from '../../weapons/WeaponSystem';
import { TargetManager } from '../../targets/TargetManager';
import { CameraComponent } from './CameraComponent';
import type { BasePawn } from '../BasePawn';

/**
 * 캐릭터의 무기 시스템과 타겟 상호작용을 담당하는 컴포넌트.
 */
export class CombatComponent extends BaseComponent {
  private weaponSystem: WeaponSystem;

  constructor(owner: BasePawn, scene: Scene, targetManager: TargetManager) {
    super(owner, scene);

    // Pawn이 소유한 카메라 컴포넌트 찾기
    const cameraComp = owner.getComponent(CameraComponent);
    if (!cameraComp) {
      throw new Error('CombatComponent requires a CameraComponent on the Pawn');
    }

    // 무기 시스템 초기화 (Pawn의 카메라와 연동)
    this.weaponSystem = new WeaponSystem(scene, cameraComp.camera, targetManager);

    // 반동 효과 연결 (무기 발사 시 카메라 킥)
    this.weaponSystem.setOnFireCallback(() => {
      cameraComp.applyRecoil(0.015); // 반동 강도 조절 가능
    });
  }

  public setAiming(isAiming: boolean): void {
    this.weaponSystem.setAiming(isAiming);
  }

  public update(deltaTime: number): void {
    this.weaponSystem.update(deltaTime);
  }

  public getWeaponSystem(): WeaponSystem {
    return this.weaponSystem;
  }

  public dispose(): void {
    super.dispose();
    // WeaponSystem에 dispose가 있다면 호출 필요 (현재는 event listener 제거 등)
  }
}
