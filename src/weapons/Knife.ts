import {
  Scene,
  UniversalCamera,
  MeshBuilder,
  Vector3,
  StandardMaterial,
  Color3,
  Mesh,
} from '@babylonjs/core';
import { MeleeWeapon } from './MeleeWeapon.ts';
import { TargetManager } from '../targets/TargetManager.ts';
import { GameObservables } from '../core/events/GameObservables.ts';

/**
 * 근접 공격용 칼(Knife) 클래스.
 */
export class Knife extends MeleeWeapon {
  public name = 'Knife';
  public damage = 50;
  public range = 2.5;

  private swingAnimationTimer = 0;
  private isAnimating = false;
  private defaultRotation = new Vector3(0, 0, 0);
  private defaultPosition = new Vector3(0.4, -0.4, 0.6);

  constructor(
    scene: Scene,
    camera: UniversalCamera,
    targetManager: TargetManager,
    onScore?: (points: number) => void
  ) {
    super(scene, camera, targetManager, onScore);
    this.createMesh();
  }

  private createMesh(): void {
    // 임시 칼 매시 (박스 형태)
    const handle = MeshBuilder.CreateBox(
      'knifeHandle',
      { width: 0.03, height: 0.1, depth: 0.03 },
      this.scene
    );
    const blade = MeshBuilder.CreateBox(
      'knifeBlade',
      { width: 0.01, height: 0.2, depth: 0.04 },
      this.scene
    );
    blade.position.y = 0.15;

    const handleMat = new StandardMaterial('handleMat', this.scene);
    handleMat.diffuseColor = new Color3(0.2, 0.2, 0.2);
    handle.material = handleMat;

    const bladeMat = new StandardMaterial('bladeMat', this.scene);
    bladeMat.diffuseColor = new Color3(0.8, 0.8, 0.8);
    bladeMat.specularColor = new Color3(1, 1, 1);
    blade.material = bladeMat;

    this.weaponMesh = Mesh.MergeMeshes([handle, blade], true, true, undefined, false, true);
    if (this.weaponMesh) {
      this.weaponMesh.name = 'KnifeMesh';
      this.weaponMesh.parent = this.camera;
      this.weaponMesh.position.copyFrom(this.defaultPosition);
      this.weaponMesh.rotation = new Vector3(Math.PI / 2, 0, 0);
      this.defaultRotation.copyFrom(this.weaponMesh.rotation);
      this.weaponMesh.setEnabled(false);
    }
  }

  public swing(): boolean {
    if (this.isSwinging) return false;

    this.isSwinging = true;
    this.isAnimating = true;
    this.swingAnimationTimer = 0;

    // 발사 이벤트 발행 (사운드 및 HUD 연동용)
    GameObservables.weaponFire.notifyObservers({
      weaponId: this.name,
      ammoRemaining: 0,
    });

    // 공격 판정 (카메라 정면 레이캐스트)
    const ray = this.camera.getForwardRay(this.range);
    const hit = this.scene.pickWithRay(ray, (mesh) => {
      return mesh.isPickable && mesh.name.startsWith('target');
    });

    if (hit?.hit && hit.pickedMesh) {
      const meshName = hit.pickedMesh.name;
      const nameParts = meshName.split('_');
      const targetId = `${nameParts[0]}_${nameParts[1]}`;
      const part = nameParts[2] || 'body';

      const destroyed = this.targetManager.hitTarget(targetId, part, this.damage);

      if (this.onScoreCallback) {
        const score = destroyed ? 150 : 30; // 근접 공격은 점수를 조금 더 줌
        this.onScoreCallback(score);
      }
    }

    // 일정 시간 후 공격 가능 상태로 복귀
    setTimeout(() => {
      this.isSwinging = false;
    }, 400);

    return true;
  }

  public update(deltaTime: number): void {
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
