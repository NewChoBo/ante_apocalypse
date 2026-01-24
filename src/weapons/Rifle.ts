import {
  Scene,
  UniversalCamera,
  Vector3,
  MeshBuilder,
  Color3,
  Animation,
  PBRMaterial,
  CSG,
} from '@babylonjs/core';
import { Firearm } from './Firearm.ts';

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
    super(scene, camera, 30, 90, onScore, applyRecoil);
    this.muzzleOffset = new Vector3(0, 0.05, -0.4); // 총구 상단 정렬, 모델 회전 고려
    this.createWeaponModel();
  }

  private createWeaponModel(): void {
    // 소총 본체 (Root Mesh)
    this.weaponMesh = MeshBuilder.CreateBox('rifle_root', { size: 0.01 }, this.scene);
    this.weaponMesh.isVisible = false;

    // --- 재질 정의 (PBR) ---
    const metalMat = new PBRMaterial('rifle_metal', this.scene);
    metalMat.albedoColor = new Color3(0.12, 0.12, 0.12);
    metalMat.metallic = 0.8;
    metalMat.roughness = 0.4;

    const plasticMat = new PBRMaterial('rifle_plastic', this.scene);
    plasticMat.albedoColor = new Color3(0.05, 0.05, 0.05);
    plasticMat.metallic = 0.0;
    plasticMat.roughness = 0.7;

    // --- 1. 몸체 (Receiver) ---
    const receiver = MeshBuilder.CreateBox(
      'rifle_receiver',
      { width: 0.06, height: 0.08, depth: 0.4 },
      this.scene
    );
    receiver.material = metalMat;
    receiver.parent = this.weaponMesh;

    // --- 2. 핸드가드 (Handguard) with Vents (CSG) ---
    const handguardBox = MeshBuilder.CreateBox(
      'handguard_box',
      { width: 0.065, height: 0.07, depth: 0.35 },
      this.scene
    );
    handguardBox.position.z = 0.35; // 리시버 앞쪽

    // 쿨링 벤트 (Cooling Vents) - 반복 구멍 뚫기
    let handguardCSG = CSG.FromMesh(handguardBox);

    // 왼쪽 벤트
    for (let i = 0; i < 3; i++) {
      const vent = MeshBuilder.CreateBox(
        `vent_l_${i}`,
        { width: 0.02, height: 0.02, depth: 0.08 },
        this.scene
      );
      vent.position.set(-0.03, 0.01, 0.25 + i * 0.1);
      const ventCSG = CSG.FromMesh(vent);
      handguardCSG = handguardCSG.subtract(ventCSG);
      vent.dispose();
    }
    // 오른쪽 벤트
    for (let i = 0; i < 3; i++) {
      const vent = MeshBuilder.CreateBox(
        `vent_r_${i}`,
        { width: 0.02, height: 0.02, depth: 0.08 },
        this.scene
      );
      vent.position.set(0.03, 0.01, 0.25 + i * 0.1);
      const ventCSG = CSG.FromMesh(vent);
      handguardCSG = handguardCSG.subtract(ventCSG);
      vent.dispose();
    }

    const handguard = handguardCSG.toMesh('rifle_handguard', plasticMat, this.scene);
    handguard.parent = this.weaponMesh;
    handguardBox.dispose();

    // --- 3. 총열 (Barrel) with CSG (Hollow Tip) ---
    const barrelOut = MeshBuilder.CreateCylinder(
      'barrel_out',
      { diameter: 0.025, height: 0.5 },
      this.scene
    );
    const barrelIn = MeshBuilder.CreateCylinder(
      'barrel_in',
      { diameter: 0.015, height: 0.55 },
      this.scene
    ); // 좀 더 길게 뚫기

    const barrelOutCSG = CSG.FromMesh(barrelOut);
    const barrelInCSG = CSG.FromMesh(barrelIn);
    const booleanBarrelCSG = barrelOutCSG.subtract(barrelInCSG);

    const barrel = booleanBarrelCSG.toMesh('rifle_barrel', metalMat, this.scene);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.45; // 핸드가드 너머까지
    barrel.parent = this.weaponMesh;

    barrelOut.dispose();
    barrelIn.dispose();

    // --- 4. 개머리판 (Stock) ---
    const stock = MeshBuilder.CreateBox(
      'rifle_stock',
      { width: 0.05, height: 0.12, depth: 0.25 },
      this.scene
    );
    stock.material = plasticMat;
    stock.position.set(0, -0.02, -0.32);
    stock.parent = this.weaponMesh;

    // --- 5. 조준경/레일 (Rail) ---
    const rail = MeshBuilder.CreateBox(
      'rifle_rail',
      { width: 0.04, height: 0.015, depth: 0.4 },
      this.scene
    );
    rail.material = metalMat;
    rail.position.y = 0.048; // 리시버 위
    rail.parent = this.weaponMesh;

    // 배치 및 설정
    this.weaponMesh.parent = this.camera;
    this.weaponMesh.position = new Vector3(0.4, -0.3, 0.6);
    this.weaponMesh.rotation.y = Math.PI;
    this.setIdleState();
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
