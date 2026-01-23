import { Scene } from '@babylonjs/core';
import { BaseComponent } from './BaseComponent';
import { WeaponSystem } from '../../weapons/WeaponSystem';
import { TargetManager } from '../../targets/TargetManager';
import { WeaponEffectComponent } from './WeaponEffectComponent';
import { GameObservables } from '../events/GameObservables';
import { IMuzzleProvider } from '../../types/IWeapon';
import { CameraComponent } from './CameraComponent';
import type { BasePawn } from '../BasePawn';

/**
 * 캐릭터의 무기 시스템과 타겟 상호작용을 담당하는 컴포넌트.
 */
export class CombatComponent extends BaseComponent {
  private weaponSystem: WeaponSystem;
  private effectComponent: WeaponEffectComponent;

  constructor(owner: BasePawn, scene: Scene, targetManager: TargetManager) {
    super(owner, scene);

    // Pawn이 소유한 카메라 컴포넌트 찾기
    const cameraComp = owner.getComponent(CameraComponent);
    if (!cameraComp) {
      throw new Error('CombatComponent requires a CameraComponent on the Pawn');
    }

    // 무기 시스템 초기화 (Pawn의 카메라와 연동)
    this.weaponSystem = new WeaponSystem(scene, cameraComp.camera, targetManager);

    // 이펙트 컴포넌트 초기화
    this.effectComponent = new WeaponEffectComponent(owner, scene);

    // 1. 반동 효과 연결
    this.weaponSystem.setOnFireCallback(() => {
      (cameraComp as CameraComponent).applyRecoil(0.015);
    });

    // 2. 총구 화염 연결 (Observable 사용)
    GameObservables.weaponFire.add(() => {
      const weapon = this.weaponSystem.getCurrentWeapon();
      this.effectComponent.playGunshot(); // 사운드 재생 추가

      if ('getMuzzleTransform' in weapon) {
        const { position, direction, transformNode } = (
          weapon as unknown as IMuzzleProvider
        ).getMuzzleTransform();
        this.effectComponent.emitMuzzleFlash(position, direction, transformNode);
      }
    });

    // 3. 피격 이펙트 연결 (Observable 사용)
    GameObservables.targetHit.add((hitInfo) => {
      this.effectComponent.emitHitSpark(hitInfo.position);
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
