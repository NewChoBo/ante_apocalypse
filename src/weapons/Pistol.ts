import { Scene, UniversalCamera, Animation, Mesh, Vector3, MeshBuilder } from '@babylonjs/core';
import { Firearm } from './Firearm.ts';
import { AssetLoader } from '../core/utils/AssetLoader.ts';

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
    super(scene, camera, 12, 48, onScore, applyRecoil);
    this.muzzleOffset = new Vector3(0, 0.05, -0.2); // 총구 상단 정렬
    this.createWeaponModel();
  }

  private async createWeaponModel(): Promise<void> {
    // 외부 모델 로드 (Microsoft MRTK Sample Gun)
    // Corrected URL from confirmed repo search
    const rootUrl =
      'https://raw.githubusercontent.com/microsoft/MixedRealityToolkit/main/SpatialInput/Samples/DemoRoom/Media/Models/';
    const fileName = 'Gun.glb';

    try {
      const meshes = await AssetLoader.loadModel(this.scene, rootUrl, fileName);

      // 루트 노드 설정 (GLB는 보통 __root__ 노드를 가짐)
      this.weaponMesh = meshes[0];

      // --- 모델 정규화 (Normalization) ---
      // 1. 초기화
      this.weaponMesh.parent = null;
      this.weaponMesh.rotationQuaternion = null;
      this.weaponMesh.rotation = Vector3.Zero();
      this.weaponMesh.scaling = Vector3.One();

      // 2. 바운딩 박스 계산 및 스케일 조정
      const hierarchy = this.weaponMesh.getHierarchyBoundingVectors();
      const size = hierarchy.max.subtract(hierarchy.min);
      const maxDim = Math.max(size.x, size.y, size.z);

      // 목표 크기: 약 30cm (0.3 unit)
      const targetSize = 0.3;
      const scaleFactor = targetSize / maxDim;

      this.weaponMesh.scaling = new Vector3(scaleFactor, scaleFactor, scaleFactor);

      // 3. 카메라에 부착 및 위치 잡기
      this.weaponMesh.parent = this.camera;

      // 위치: 화면 오른쪽 아래 (고정값 사용)
      // 회전: Y축 180도 (보통 GLB는 -Z가 정면이므로)
      this.weaponMesh.position = new Vector3(0.2, -0.15, 0.4);
      this.weaponMesh.rotation = new Vector3(0, Math.PI, 0);

      console.log(`Pistol Loaded. Original Size: ${maxDim}, Applied Scale: ${scaleFactor}`);

      // 재질 오버라이드 (그림자 등)
      meshes.forEach((m) => {
        if (m instanceof Mesh) {
          m.receiveShadows = true;
          m.isPickable = false;
        }
      });

      this.setIdleState();
    } catch (e) {
      console.error('Failed to load Gun.glb, falling back to primitive', e);
      // 실패 시 폴백 (기본 박스)
      this.weaponMesh = MeshBuilder.CreateBox('pistol_fallback', { size: 0.1 }, this.scene);
      this.weaponMesh.parent = this.camera;
      this.weaponMesh.position = new Vector3(0.35, -0.25, 0.45);
    }
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
