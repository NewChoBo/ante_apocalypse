import {
  Scene,
  UniversalCamera,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Animation,
} from '@babylonjs/core';
import { Firearm } from './Firearm.ts';
import { TargetManager } from '../targets/TargetManager.ts';

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
    targetManager: TargetManager,
    onScore?: (points: number) => void,
    applyRecoil?: (force: number) => void
  ) {
    super(scene, camera, targetManager, 12, 48, onScore, applyRecoil);
    this.muzzleOffset = new Vector3(0, 0.05, -0.2); // 총구 상단 정렬
    this.createWeaponModel();
  }

  private createWeaponModel(): void {
    // 권총 모델 (짧은 박스)
    this.weaponMesh = MeshBuilder.CreateBox(
      'pistol',
      { width: 0.06, height: 0.12, depth: 0.25 },
      this.scene
    );

    const material = new StandardMaterial('pistolMat', this.scene);
    material.diffuseColor = new Color3(0.1, 0.1, 0.1);
    material.specularColor = new Color3(0.5, 0.5, 0.5);
    this.weaponMesh.material = material;

    this.weaponMesh.parent = this.camera;
    this.weaponMesh.position = new Vector3(0.25, -0.15, 0.4);
    this.weaponMesh.rotation.y = Math.PI;
  }

  protected onFire(): void {
    this.playRecoilAnimation();
    this.performRaycast();
  }

  private playRecoilAnimation(): void {
    if (!this.weaponMesh) return;

    const recoilAnim = new Animation(
      'recoil',
      'rotation.x',
      60,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    // 권총은 반동이 더 큼
    recoilAnim.setKeys([
      { frame: 0, value: 0 },
      { frame: 2, value: 0.1 },
      { frame: 12, value: 0 },
    ]);

    this.weaponMesh.animations = [recoilAnim];
    this.scene.beginAnimation(this.weaponMesh, 0, 12, false);
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
