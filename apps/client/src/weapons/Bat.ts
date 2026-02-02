import { Scene, UniversalCamera } from '@babylonjs/core';
import { MeleeWeapon } from './MeleeWeapon';
import { ProceduralWeaponBuilder } from './ProceduralWeaponBuilder';
import { MeleeWeaponConfigs } from '../config/WeaponConfig';

/**
 * 야구 방망이 (Bat) - 근접 무기
 * 칼보다 공격력이 높고 사거리가 길지만, 공격 속도가 느림
 */
export class Bat extends MeleeWeapon {
  public name = 'Bat';
  public damage = 0;
  public range = 0;

  protected weaponConfig = MeleeWeaponConfigs.Bat;

  constructor(scene: Scene, camera: UniversalCamera) {
    super(scene, camera);
    this.createMesh();
  }

  private createMesh(): void {
    this.createMeshFromBuilder((scene) => ProceduralWeaponBuilder.createBat(scene));
  }

  public swing(): boolean {
    if (this.isSwinging) return false;
    this.startSwing();
    return true;
  }
}
