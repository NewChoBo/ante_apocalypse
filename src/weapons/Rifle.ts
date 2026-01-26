import { Scene, UniversalCamera, Vector3, Mesh, Color3, PBRMaterial } from '@babylonjs/core';
import { Firearm } from './Firearm';

/**
 * 소총 (Rifle) - 연발 가능
 * firingMode = 'auto' - 마우스 홀드 시 연속 발사
 */
export class Rifle extends Firearm {
  public name = 'Rifle';
  public magazineSize = 30;
  public damage = 25;
  public fireRate = 0.1; // 초당 10발
  public range = 100;
  public reloadTime = 2.0;
  public firingMode: 'semi' | 'auto' = 'auto';
  public recoilForce = 0.008; // 소총은 연사 속도가 빨라 반동이 적음

  constructor(
    scene: Scene,
    camera: UniversalCamera,
    onScore?: (points: number) => void,
    applyRecoil?: (force: number) => void
  ) {
    super(scene, camera, 30, 240, onScore, applyRecoil);
    this.muzzleOffset = new Vector3(0, 0.06, 0.4);

    this.instantiateWeaponModel(
      'rifle',
      0.6,
      new Vector3(0.25, -0.25, 0.6),
      new Vector3(0, Math.PI, 0),
      1.6,
      (m: Mesh) => {
        if (m.material && m.material instanceof PBRMaterial) {
          m.material.albedoColor = new Color3(0.3, 0.35, 0.25);
          m.material.roughness = 0.6;
        }
      }
    );
  }

  protected onFire(): void {
    // Intensity: 0.03, Duration: 10 frames, Peak: 3
    this.playRecoilAnimation(0.03, 10, 3);
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
