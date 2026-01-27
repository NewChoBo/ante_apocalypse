export interface IWeaponStats {
  name: string;
  damage: number;
  range: number;
  // Optional for Melee
  fireRate?: number;
  magazineSize?: number;
  reloadTime?: number;
  firingMode?: 'semi' | 'auto';
  recoilForce?: number;
}
