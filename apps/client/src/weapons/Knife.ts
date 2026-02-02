import { Scene, UniversalCamera } from '@babylonjs/core';
import { MeleeWeapon } from './MeleeWeapon';
import { ProceduralWeaponBuilder } from './ProceduralWeaponBuilder';
import { MeleeWeaponConfigs } from '../config/WeaponConfig';

/**
 * 근접 공격용 칼(Knife) 클래스.
 */
export class Knife extends MeleeWeapon {
  public name = 'Knife';
  public damage = 0;
  public range = 0;

  protected weaponConfig = MeleeWeaponConfigs.Knife;

  constructor(scene: Scene, camera: UniversalCamera) {
    super(scene, camera);
    this.createMesh();
  }

  private createMesh(): void {
    this.createMeshFromBuilder((scene) => ProceduralWeaponBuilder.createKnife(scene));
  }

  public swing(): boolean {
    if (this.isSwinging) return false;
    this.startSwing();
    return true;
  }
}
