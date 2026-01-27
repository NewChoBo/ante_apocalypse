import { Scene, UniversalCamera, Vector3 } from '@babylonjs/core';
import { Firearm } from './Firearm';
import weaponData from '@/assets/data/weapons/weapons.json';

/**
 * 권총 (Pistol) - 단발
 * firingMode = 'semi' - 클릭당 1발만 발사
 */
export class Pistol extends Firearm {
  public name = 'Pistol';
  public magazineSize: number;
  public damage: number;
  public fireRate: number;
  public range: number;
  public reloadTime: number;
  public firingMode: 'semi' | 'auto';
  public recoilForce: number;

  constructor(
    scene: Scene,
    camera: UniversalCamera,
    onScore?: (points: number) => void,
    applyRecoil?: (force: number) => void
  ) {
    const stats = (weaponData as any)['Pistol'];
    super(scene, camera, stats.magazineSize, stats.reserveAmmo, onScore, applyRecoil);

    this.magazineSize = stats.magazineSize;
    this.damage = stats.damage;
    this.fireRate = stats.fireRate;
    this.range = stats.range;
    this.reloadTime = stats.reloadTime;
    this.firingMode = stats.firingMode;
    this.recoilForce = stats.recoilForce;

    this.muzzleOffset = new Vector3(
      stats.muzzleOffset.x,
      stats.muzzleOffset.y,
      stats.muzzleOffset.z
    );

    // Instantiate model from JSON config
    this.instantiateWeaponModel(
      stats.model.assetName,
      stats.model.targetSize,
      new Vector3(stats.model.position.x, stats.model.position.y, stats.model.position.z),
      new Vector3(stats.model.rotation.x, stats.model.rotation.y, stats.model.rotation.z)
    );
  }

  protected onFire(): void {
    // Intensity: 0.1, Duration: 12 frames, Peak: 2
    this.playRecoilAnimation(0.1, 12, 2);
    this.performRaycast();
  }

  protected onReloadStart(): void {
    const msg = document.getElementById('reload-message');
    if (msg) msg.style.display = 'block';
  }

  protected onReloadEnd(): void {
    const msg = document.getElementById('reload-message');
    if (msg) msg.style.display = 'none';
  }
}
