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
import { TargetRegistry } from '../core/systems/TargetRegistry';
import { GameObservables } from '../core/events/GameObservables';

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
  private defaultPosition = new Vector3(0.5, -0.5, 0.75);

  constructor(scene: Scene, camera: UniversalCamera, onScore?: (points: number) => void) {
    super(scene, camera, onScore);
    this.createMesh();
  }

  private createMesh(): void {
    // Advanced Procedural Bat (Tapered Body, Grip, Knob)

    // 1. Knob (Bottom)
    const knob = MeshBuilder.CreateSphere('batKnob', { diameter: 0.06 }, this.scene);
    knob.position.y = -0.38; // Bottom end
    const knobMat = new StandardMaterial('knobMat', this.scene);
    knobMat.diffuseColor = new Color3(0.5, 0.35, 0.2); // Wood
    knob.material = knobMat;

    // 2. Grip (Handle)
    const grip = MeshBuilder.CreateCylinder(
      'batGrip',
      { height: 0.25, diameter: 0.035 },
      this.scene
    );
    grip.position.y = -0.25; // Above knob
    const gripMat = new StandardMaterial('gripMat', this.scene);
    gripMat.diffuseColor = new Color3(0.1, 0.1, 0.1); // Tape/Grip
    grip.material = gripMat;

    // 3. Body (Tapered barrel)
    const body = MeshBuilder.CreateCylinder(
      'batBody',
      { height: 0.55, diameterBottom: 0.035, diameterTop: 0.07 },
      this.scene
    );
    body.position.y = 0.15; // Above grip
    const bodyMat = new StandardMaterial('bodyMat', this.scene);
    bodyMat.diffuseColor = new Color3(0.6, 0.4, 0.25); // Light Wood
    body.material = bodyMat;

    // 4. Cap (Top rounded)
    const cap = MeshBuilder.CreateSphere('batCap', { diameter: 0.07 }, this.scene);
    cap.position.y = 0.425; // Top of body
    cap.material = bodyMat; // Same wood

    this.weaponMesh = Mesh.MergeMeshes([knob, grip, body, cap], true, true, undefined, false, true);

    if (this.weaponMesh) {
      this.weaponMesh.name = 'BatMesh_Proc';
      this.weaponMesh.parent = this.camera;

      // Idle Position restoration
      this.weaponMesh.position.copyFrom(this.defaultPosition);

      // Rotation: Ready to swing
      this.weaponMesh.rotation = new Vector3(Math.PI / 2.5, 0, Math.PI / 4);

      this.weaponMesh.receiveShadows = true;

      this.defaultRotation.copyFrom(this.weaponMesh.rotation);
      this.setIdleState();
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
    this.updateAnimations(deltaTime);
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
