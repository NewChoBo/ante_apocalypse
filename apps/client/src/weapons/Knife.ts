import { MeleeWeapon } from './MeleeWeapon';
import { ProceduralWeaponBuilder } from './ProceduralWeaponBuilder';
import { MeleeWeaponConfigs } from '../config/WeaponConfig';
import type { GameContext } from '../types/GameContext';

/**
 * 근접 공격용 칼(Knife) 클래스.
 */
export class Knife extends MeleeWeapon {
  public name = 'Knife';
  public damage = 0;
  public range = 0;

  protected weaponConfig = MeleeWeaponConfigs.Knife;

  constructor(context: GameContext) {
    super(context);
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

  public addAmmo(_amount: number): void {
    // Melee weapons don't use ammo
  }

  public reset(): void {
    // Melee weapons have no state to reset
  }
}
