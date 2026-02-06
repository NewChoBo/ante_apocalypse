import { MeleeWeapon } from './MeleeWeapon';
import { ProceduralWeaponBuilder } from './ProceduralWeaponBuilder';
import { MeleeWeaponConfigs } from '../config/WeaponConfig';
import type { GameContext } from '../types/GameContext';

/**
 * 야구 방망이 (Bat) - 근접 무기
 * 칼보다 공격력이 높고 사거리가 길지만, 공격 속도가 느림
 */
export class Bat extends MeleeWeapon {
  protected weaponConfig = MeleeWeaponConfigs.Bat;

  constructor(context: GameContext) {
    super(context);
    this.stats = {
      name: this.weaponConfig.name,
      damage: this.weaponConfig.damage,
      range: this.weaponConfig.range,
      fireRate: this.weaponConfig.animation.duration,
      magazineSize: 0,
      reloadTime: 0,
    };
    this.name = this.stats.name!;
    this.damage = this.stats.damage!;
    this.range = this.stats.range!;

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

  public addAmmo(_amount: number): void {
    // Melee weapons don't use ammo
  }

  public reset(): void {
    // Melee weapons have no state to reset
  }
}
