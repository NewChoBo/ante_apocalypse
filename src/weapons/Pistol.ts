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
 * 권총 (Pistol) - 단발
 * firingMode = 'semi' - 클릭당 1발만 발사
 */
export class Pistol extends BaseWeapon {
  public name = 'Pistol';
  public magazineSize = 12;
  public damage = 50; // 높은 단발 데미지
  public fireRate = 0.3; // 발사 간격
  public range = 50;
  public reloadTime = 1.5;
  public firingMode: 'semi' | 'auto' = 'semi';

  private targetManager: TargetManager;
  private onScoreCallback: ((points: number) => void) | null = null;

  constructor(
    scene: Scene,
    camera: UniversalCamera,
    targetManager: TargetManager,
    onScore?: (points: number) => void
  ) {
    super(scene, camera, 12, 48);
    this.targetManager = targetManager;
    this.onScoreCallback = onScore || null;
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

  private performRaycast(): void {
    const forwardRay = this.camera.getForwardRay(this.range);
    const ray = new Ray(this.camera.globalPosition, forwardRay.direction, this.range);

    const pickInfo = this.scene.pickWithRay(ray, (mesh) => {
      return mesh.isPickable && mesh.name.startsWith('target');
    });

    if (pickInfo?.hit && pickInfo.pickedMesh) {
      const meshName = pickInfo.pickedMesh.name;
      const nameParts = meshName.split('_'); // target_1_head -> ["target", "1", "head"]

      const targetId = `${nameParts[0]}_${nameParts[1]}`;
      const part = nameParts[2] || 'body';

      const isHeadshot = part === 'head';
      const destroyed = this.targetManager.hitTarget(targetId, part, this.damage);

      if (this.onScoreCallback) {
        // 헤드샷 시 2배 점수 보너스
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

    // 권총은 반동이 더 큼
    recoilAnim.setKeys([
      { frame: 0, value: 0 },
      { frame: 2, value: 0.1 },
      { frame: 12, value: 0 },
    ]);

    this.weaponMesh.animations = [recoilAnim];
    this.scene.beginAnimation(this.weaponMesh, 0, 12, false);
  }

  private createHitEffect(position: Vector3): void {
    const spark = MeshBuilder.CreateSphere('hitSpark', { diameter: 0.25 }, this.scene);
    spark.position = position;

    const material = new StandardMaterial('sparkMat', this.scene);
    material.emissiveColor = new Color3(1, 0.6, 0.2);
    spark.material = material;

    setTimeout(() => spark.dispose(), 120);
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
