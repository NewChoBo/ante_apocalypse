import {
  Scene,
  UniversalCamera,
  Animation,
  Mesh,
  Vector3,
  MeshBuilder,
  AbstractMesh,
} from '@babylonjs/core';
import { Firearm } from './Firearm';
import { AssetLoader } from '../core/AssetLoader';

/**
 * 권총 (Pistol) - 단발
 * firingMode = 'semi' - 클릭당 1발만 발사
 */
export class Pistol extends Firearm {
  // Removed hardcoded stats, these should be passed to the super constructor or managed by the base class
  public name = 'Pistol';
  public magazineSize = 0;
  public damage = 0;
  public fireRate = 0;
  public range = 0;
  public reloadTime = 0;
  public firingMode: 'semi' | 'auto' = 'semi';
  public recoilForce = 0.015;

  constructor(
    scene: Scene,
    camera: UniversalCamera,
    onScore?: (points: number) => void,
    applyRecoil?: (force: number) => void
  ) {
    // 탄약 수량도 서버에서 관리하는 게 좋지만, 일단 기본값으로 초기화
    super(scene, camera, 0, 0, onScore, applyRecoil);
    this.muzzleOffset = new Vector3(0, 0.06, 0.2); // 권총 총구 위치 조정
    this.createWeaponModel();
  }

  private async createWeaponModel(): Promise<void> {
    try {
      // Reuse 'rifle' asset (Gun.glb) for Pistol as they share the same source model
      const entries = AssetLoader.getInstance().instantiateMesh('rifle');

      if (!entries) {
        throw new Error(
          `Gun asset not preloaded. Loader status: isReady=${AssetLoader.getInstance().ready}`
        );
      }

      this.weaponMesh = entries.rootNodes[0] as AbstractMesh;
      if (!this.weaponMesh) {
        throw new Error('[Pistol] Failed to find root node in gun asset');
      }

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
      const scaleFactor = targetSize / (maxDim || 1);

      this.weaponMesh.scaling = new Vector3(scaleFactor, scaleFactor, scaleFactor);

      // 3. 카메라에 부착 및 위치 잡기
      this.weaponMesh.parent = this.camera;

      // 위치: 화면 오른쪽 아래 (고정값 사용)
      // 회전: Y축 180도 (보통 GLB는 -Z가 정면이므로)
      this.weaponMesh.position = new Vector3(0.2, -0.15, 0.4);
      this.weaponMesh.rotation = new Vector3(0, Math.PI, 0);

      // 초기 가시성 설정 (현재 활성화 상태 따름)
      this.weaponMesh.setEnabled(this.isActive);

      console.log(`Pistol Instantiated. Scale: ${scaleFactor}`);

      // 재질 오버라이드 (그림자 등)
      // Pistol uses default color (no override), but ensuring shadow props
      const allMeshes = this.weaponMesh.getChildMeshes(false);
      allMeshes.forEach((m) => {
        if (m instanceof Mesh) {
          m.receiveShadows = true;
          m.isPickable = false;
        }
      });

      this.setIdleState();
    } catch (e) {
      console.error('Failed to instantiate Pistol model:', e);
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
