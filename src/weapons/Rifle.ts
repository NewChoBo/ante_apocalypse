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
    targetManager: TargetManager,
    onScore?: (points: number) => void,
    applyRecoil?: (force: number) => void
  ) {
    super(scene, camera, targetManager, 30, 90, onScore, applyRecoil);
    this.muzzleOffset = new Vector3(0, 0.05, -0.4); // 총구 상단 정렬, 모델 회전 고려
    this.createWeaponModel();
  }

  private createWeaponModel(): void {
    // 소총 모델 (긴 박스)
    this.weaponMesh = MeshBuilder.CreateBox(
      'rifle',
      { width: 0.08, height: 0.1, depth: 0.6 },
      this.scene
    );

    const material = new StandardMaterial('rifleMat', this.scene);
    material.diffuseColor = new Color3(0.15, 0.15, 0.15);
    material.specularColor = new Color3(0.4, 0.4, 0.4);
    this.weaponMesh.material = material;

    this.weaponMesh.parent = this.camera;
    this.weaponMesh.position = new Vector3(0.3, -0.2, 0.5);
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

    recoilAnim.setKeys([
      { frame: 0, value: 0 },
      { frame: 3, value: 0.03 },
      { frame: 10, value: 0 },
    ]);

    this.weaponMesh.animations = [recoilAnim];
    this.scene.beginAnimation(this.weaponMesh, 0, 10, false);
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
