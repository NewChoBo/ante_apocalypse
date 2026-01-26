import { Scene, UniversalCamera, Vector3 } from '@babylonjs/core';
import { Firearm } from './Firearm';

/**
 * 권총 (Pistol) - 단발
 * firingMode = 'semi' - 클릭당 1발만 발사
 */
export class Pistol extends Firearm {
  public name = 'Pistol';
  public magazineSize = 12;
  public damage = 50; // 높은 단발 데미지
  public fireRate = 0.3; // 발사 간격
  public range = 50;
  public reloadTime = 1.5;
  public firingMode: 'semi' | 'auto' = 'semi';
  public recoilForce = 0.015;

  constructor(
    scene: Scene,
    camera: UniversalCamera,
    onScore?: (points: number) => void,
    applyRecoil?: (force: number) => void
  ) {
    super(scene, camera, 12, 120, onScore, applyRecoil);
    this.muzzleOffset = new Vector3(0, 0.06, 0.2);

    // Scale: 0.3, Pos: (0.2, -0.15, 0.4), Rot: (0, PI, 0)
    // Using 'rifle' asset for pistol (placeholder logic maintained)
    this.instantiateWeaponModel(
      'rifle',
      0.3,
      new Vector3(0.2, -0.15, 0.4),
      new Vector3(0, Math.PI, 0)
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
