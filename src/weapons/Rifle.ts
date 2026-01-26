import {
  Scene,
  UniversalCamera,
  Vector3,
  MeshBuilder,
  Animation,
  Mesh,
  Color3,
  PBRMaterial,
  AbstractMesh,
} from '@babylonjs/core';
import { Firearm } from './Firearm';
import { AssetLoader } from '../core/loaders/AssetLoader';

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
    super(scene, camera, 30, 240, onScore, applyRecoil); // Rifle: 30발 탄창, 240발 예비 탄약
    this.muzzleOffset = new Vector3(0, 0.06, 0.4); // 소총 총구 위치 조정 // 총구 상단 정렬, 모델 회전 고려
    this.createWeaponModel();
  }

  private async createWeaponModel(): Promise<void> {
    try {
      const entries = AssetLoader.getInstance().instantiateMesh('rifle');

      if (!entries) {
        throw new Error(
          `Rifle asset not preloaded. Loader status: isReady=${AssetLoader.getInstance().ready}`
        );
      }

      // Gun.glb often comes with a __root__ or specific node structure.
      // We assume entries.rootNodes[0] is the parent.
      this.weaponMesh = entries.rootNodes[0] as AbstractMesh;
      if (!this.weaponMesh) {
        throw new Error('[Rifle] Failed to find root node in rifle asset');
      }

      // --- 모델 정규화 (Normalization) ---
      // 1. 초기화
      this.weaponMesh.parent = null;
      this.weaponMesh.rotationQuaternion = null;
      this.weaponMesh.rotation = Vector3.Zero();
      this.weaponMesh.scaling = Vector3.One();

      // 2. 바운딩 박스 계산 및 스케일 조정 (Rifle Scale)
      const hierarchy = this.weaponMesh.getHierarchyBoundingVectors();
      const size = hierarchy.max.subtract(hierarchy.min);
      const maxDim = Math.max(size.x, size.y, size.z);

      // 목표 크기: 약 60cm ~ 70cm (0.6 unit) - 소총은 권총보다 큼
      const targetSize = 0.6;
      // Gun.glb might be already small or huge.
      // Preloading doesn't change original size.
      const scaleFactor = targetSize / (maxDim || 1); // safe div

      // 소총 특화: 길이(Z)를 더 늘려 Long barrel 느낌 내기 (Non-uniform Scaling)
      this.weaponMesh.scaling = new Vector3(scaleFactor, scaleFactor, scaleFactor * 1.6);

      // 3. 카메라에 부착 및 위치 잡기
      this.weaponMesh.parent = this.camera;

      // 위치: 화면 오른쪽 아래 (소총은 좀 더 앞으로)
      this.weaponMesh.position = new Vector3(0.25, -0.25, 0.6);
      this.weaponMesh.rotation = new Vector3(0, Math.PI, 0);

      // 초기 가시성 설정
      this.weaponMesh.setEnabled(this.isActive);

      // 재질 오버라이드 (색상 변경으로 구분)
      // instantiateMesh creates clones. We can modify them safely.
      const allMeshes = this.weaponMesh.getChildMeshes(false);
      allMeshes.forEach((m) => {
        if (m instanceof Mesh) {
          m.receiveShadows = true;
          m.isPickable = false;

          // 기존 재질이 있다면 색상 변조
          if (m.material && m.material instanceof PBRMaterial) {
            // Clone material if shared to avoid changing other rifles?
            // instantiateModelsToScene(..., false) means clones share materials.
            // If we want unique color for THIS rifle, we should clone material or rely on valid sharing if all rifles are same.
            // But here we set color for "Rifle" specifically. If we had "Sniper" sharing logical asset, it might be issue.
            // For now, let's clone material to be safe if we modify it.
            // Only clone if not already unique?
            // Simple approach: m.material = m.material.clone(m.name + '_mat');

            // However, Rifle class implies all Rifles are Green. So sharing is fine IF they are all Rifles.
            // If we use 'Gun.glb' for Pistol too, then we have a problem.
            // Pistol uses 'Gun.glb' loaded separately?
            // If Pistol uses 'rifle' asset key, then modifying material here affects Pistol.
            // Let's assume Pistol has its own logic or asset.

            // 약간의 녹갈색(Military Olive) 틴트 추가하여 권총과 구분
            m.material.albedoColor = new Color3(0.3, 0.35, 0.25);
            m.material.roughness = 0.6; // 좀 더 거친 느낌
          }
        }
      });

      this.setIdleState();
    } catch (e) {
      console.error('Failed to instantiate Rifle model:', e);
      // 실패 시 폴백
      this.weaponMesh = MeshBuilder.CreateBox('rifle_fallback', { size: 0.1 }, this.scene);
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
