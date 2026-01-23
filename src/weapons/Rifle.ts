import {
  Scene,
  UniversalCamera,
  Ray,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Animation,
} from '@babylonjs/core';
import { BaseWeapon } from './BaseWeapon.ts';
import { TargetManager } from '../targets/TargetManager.ts';

/**
 * 소총 (Rifle) - 연발 가능
 * firingMode = 'auto' - 마우스 홀드 시 연속 발사
 */
export class Rifle extends BaseWeapon {
  public name = 'Rifle';
  public magazineSize = 30;
  public damage = 25;
  public fireRate = 0.1; // 초당 10발
  public range = 100;
  public reloadTime = 2.0;
  public firingMode: 'semi' | 'auto' = 'auto';

  private targetManager: TargetManager;
  private onScoreCallback: ((points: number) => void) | null = null;

  constructor(
    scene: Scene,
    camera: UniversalCamera,
    targetManager: TargetManager,
    onScore?: (points: number) => void
  ) {
    super(scene, camera, 30, 90);
    this.targetManager = targetManager;
    this.onScoreCallback = onScore || null;
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

  private performRaycast(): void {
    const forwardRay = this.camera.getForwardRay(this.range);
    const ray = new Ray(this.camera.globalPosition, forwardRay.direction, this.range);

    const pickInfo = this.scene.pickWithRay(ray, (mesh) => {
      return mesh.isPickable && mesh.name.startsWith('target');
    });

    if (pickInfo?.hit && pickInfo.pickedMesh) {
      const meshName = pickInfo.pickedMesh.name;
      const nameParts = meshName.split('_');

      const targetId = `${nameParts[0]}_${nameParts[1]}`;
      const part = nameParts[2] || 'body';

      const isHeadshot = part === 'head';
      const destroyed = this.targetManager.hitTarget(targetId, part, this.damage);

      if (this.onScoreCallback) {
        const score = destroyed ? (isHeadshot ? 200 : 100) : isHeadshot ? 30 : 10;
        this.onScoreCallback(score);
      }

      this.createHitEffect(pickInfo.pickedPoint!);
    }
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

  private createHitEffect(position: Vector3): void {
    const spark = MeshBuilder.CreateSphere('hitSpark', { diameter: 0.15 }, this.scene);
    spark.position = position;

    const material = new StandardMaterial('sparkMat', this.scene);
    material.emissiveColor = new Color3(1, 0.8, 0.3);
    spark.material = material;

    setTimeout(() => spark.dispose(), 80);
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
