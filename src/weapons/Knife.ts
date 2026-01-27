import {
  Scene,
  UniversalCamera,
  MeshBuilder,
  Vector3,
  StandardMaterial,
  Color3,
  Mesh,
} from '@babylonjs/core';
import { MeleeWeapon } from './MeleeWeapon';
import { AssetLoader } from '../core/loaders/AssetLoader';

/**
 * 근접 공격용 칼(Knife) 클래스.
 */
export class Knife extends MeleeWeapon {
  public name = 'Knife';
  public damage = 50;
  public range = 4.0;

  private swingAnimationTimer = 0;
  private isAnimating = false;
  private defaultRotation = new Vector3(0, 0, 0);
  private defaultPosition = new Vector3(0.45, -0.4, 0.65);

  constructor(scene: Scene, camera: UniversalCamera, onScore?: (points: number) => void) {
    super(scene, camera, onScore);
    this.createMesh();
  }

  private createMesh(): void {
    // Advanced Procedural Knife (Blade, Guard, Handle)

    // 1. Handle
    const handle = MeshBuilder.CreateCylinder(
      'knifeHandle',
      { height: 0.12, diameter: 0.03 },
      this.scene
    );
    const handleMat = new StandardMaterial('handleMat', this.scene);
    handleMat.diffuseColor = new Color3(0.1, 0.1, 0.1); // Black grip
    handle.material = handleMat;

    // 2. Guard (Crossguard)
    const guard = MeshBuilder.CreateBox(
      'knifeGuard',
      { width: 0.08, height: 0.015, depth: 0.02 },
      this.scene
    );
    guard.position.y = 0.065; // Top of handle
    const guardMat = new StandardMaterial('guardMat', this.scene);
    guardMat.diffuseColor = new Color3(0.3, 0.3, 0.3); // Dark Grey
    guardMat.specularColor = new Color3(0.8, 0.8, 0.8);
    guard.material = guardMat;

    // 3. Blade
    const blade = MeshBuilder.CreateBox(
      'knifeBlade',
      { width: 0.03, height: 0.18, depth: 0.005 },
      this.scene
    );
    blade.position.y = 0.16; // Above guard

    const bladeMat = new StandardMaterial('bladeMat', this.scene);
    bladeMat.diffuseColor = Color3.White();
    bladeMat.specularColor = Color3.White();
    bladeMat.emissiveColor = new Color3(0.1, 0.1, 0.1); // Slight shine
    blade.material = bladeMat;

    this.weaponMesh = Mesh.MergeMeshes([handle, guard, blade], true, true, undefined, false, true);

    if (this.weaponMesh) {
      this.weaponMesh.name = 'KnifeMesh_Proc';
      this.weaponMesh.parent = this.camera;
      this.weaponMesh.position.copyFrom(this.defaultPosition);

      // Rotate: Pointing forward-ish
      this.weaponMesh.rotation = new Vector3(Math.PI / 2, 0, 0);

      this.weaponMesh.receiveShadows = true;

      this.defaultRotation.copyFrom(this.weaponMesh.rotation);
      this.setIdleState();
      this.weaponMesh.setEnabled(false); // Start hidden
    }
  }

  public swing(): boolean {
    if (this.isSwinging) return false;

    this.isSwinging = true;
    this.isAnimating = true;
    this.swingAnimationTimer = 0;

    // 발사 이벤트 발행 (사운드)
    const sound = AssetLoader.getInstance().getSound('swipe');
    if (sound) {
      // 칼은 조금 더 높은 피치
      sound.setPlaybackRate(1.1 + Math.random() * 0.2);
      sound.play();
    }

    // UI Event
    this.onFirePredicted.notifyObservers(this);

    // 공격 판정 (보정된 다중 레이캐스트 적용)
    // MeleeWeapon.checkMeleeHit internaly calls processHit which handles damage/points.
    this.checkMeleeHit();

    // 일정 시간 후 공격 가능 상태로 복귀
    setTimeout(() => {
      this.isSwinging = false;
    }, 400);

    return true;
  }

  public update(deltaTime: number): void {
    this.updateAnimations(deltaTime);
    if (this.isAnimating && this.weaponMesh) {
      this.swingAnimationTimer += deltaTime;

      // 간단한 휘두르기 애니메이션 (회전 왕복)
      const duration = 0.4;
      const t = this.swingAnimationTimer / duration;

      if (t < 1.0) {
        // 휘두를 때 앞으로 내밀고 회전
        const swingAngle = Math.sin(t * Math.PI) * 0.8;
        this.weaponMesh.rotation.x = this.defaultRotation.x + swingAngle;
        this.weaponMesh.position.z = this.defaultPosition.z + Math.sin(t * Math.PI) * 0.2;
      } else {
        // 애니메이션 종료
        this.isAnimating = false;
        this.weaponMesh.rotation.copyFrom(this.defaultRotation);
        this.weaponMesh.position.copyFrom(this.defaultPosition);
      }
    }
  }
}
