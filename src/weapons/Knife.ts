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
import { TargetRegistry } from '../core/systems/TargetRegistry';
import { GameObservables } from '../core/events/GameObservables.ts';

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
  private defaultPosition = new Vector3(0.4, -0.4, 0.6);

  constructor(scene: Scene, camera: UniversalCamera, onScore?: (points: number) => void) {
    super(scene, camera, onScore);
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
      fireType: 'melee',
    });

    // 공격 판정 (보정된 다중 레이캐스트 적용)
    const hitResult = this.checkMeleeHit();

    if (hitResult) {
      const { targetId, part, pickedPoint } = hitResult;
      const destroyed = TargetRegistry.getInstance().hitTarget(targetId, part, this.damage);

      // 히트 이벤트 발행 (이펙트 연출용)
      GameObservables.targetHit.notifyObservers({
        targetId,
        part,
        damage: this.damage,
        position: pickedPoint,
      });

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
