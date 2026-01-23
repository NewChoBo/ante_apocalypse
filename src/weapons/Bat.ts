import {
  Scene,
  UniversalCamera,
  MeshBuilder,
  Vector3,
  StandardMaterial,
  Color3,
} from '@babylonjs/core';
import { MeleeWeapon } from './MeleeWeapon.ts';
import { TargetRegistry } from '../core/systems/TargetRegistry';
import { GameObservables } from '../core/events/GameObservables.ts';

/**
 * 야구 방망이 (Bat) - 근접 무기
 * 칼보다 공격력이 높고 사거리가 길지만, 공격 속도가 느림
 */
export class Bat extends MeleeWeapon {
  public name = 'Bat';
  public damage = 100;
  public range = 6.0;

  private swingAnimationTimer = 0;
  private isAnimating = false;
  private defaultRotation = new Vector3(0, 0, 0);
  private defaultPosition = new Vector3(0.4, -0.5, 0.7);

  constructor(scene: Scene, camera: UniversalCamera, onScore?: (points: number) => void) {
    super(scene, camera, onScore);
    this.createMesh();
  }

  private createMesh(): void {
    // 임시 방망이 매시 (긴 원통)
    const bat = MeshBuilder.CreateCylinder(
      'batMesh',
      { height: 0.8, diameterTop: 0.06, diameterBottom: 0.04 },
      this.scene
    );

    const batMat = new StandardMaterial('batMat', this.scene);
    batMat.diffuseColor = new Color3(0.6, 0.4, 0.2); // 나무 색상
    bat.material = batMat;

    this.weaponMesh = bat;
    if (this.weaponMesh) {
      this.weaponMesh.name = 'BatMesh';
      this.weaponMesh.parent = this.camera;
      this.weaponMesh.position.copyFrom(this.defaultPosition);
      this.weaponMesh.rotation = new Vector3(Math.PI / 2.5, 0, Math.PI / 4);
      this.defaultRotation.copyFrom(this.weaponMesh.rotation);
      this.weaponMesh.setEnabled(false);
    }
  }

  public swing(): boolean {
    if (this.isSwinging) return false;

    this.isSwinging = true;
    this.isAnimating = true;
    this.swingAnimationTimer = 0;

    // 공격 사운드 및 이벤트 발행 (swipe 사운드 재사용 혹은 전용 사운드)
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
        const score = destroyed ? 200 : 50;
        this.onScoreCallback(score);
      }
    }

    // 방망이는 휘두르는 데 시간이 더 걸림 (0.8초)
    setTimeout(() => {
      this.isSwinging = false;
    }, 800);

    return true;
  }

  public update(deltaTime: number): void {
    if (this.isAnimating && this.weaponMesh) {
      this.swingAnimationTimer += deltaTime;

      const duration = 0.8;
      const t = this.swingAnimationTimer / duration;

      if (t < 1.0) {
        // 더 큰 궤적으로 휘두르기
        const swingAngle = Math.sin(t * Math.PI) * 1.5;
        this.weaponMesh.rotation.z = this.defaultRotation.z - swingAngle;
        this.weaponMesh.rotation.x = this.defaultRotation.x + swingAngle * 0.5;
      } else {
        this.isAnimating = false;
        this.weaponMesh.rotation.copyFrom(this.defaultRotation);
        this.weaponMesh.position.copyFrom(this.defaultPosition);
      }
    }
  }
}
