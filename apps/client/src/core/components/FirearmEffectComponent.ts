import { Scene, Vector3, MeshBuilder, StandardMaterial, Color3, PointLight } from '@babylonjs/core';
import { BaseWeaponEffectComponent } from './BaseWeaponEffectComponent';
import { GameAssets } from '../GameAssets';
import { GameObservables } from '../events/GameObservables';
import type { BasePawn } from '../BasePawn';

/**
 * 총기류 전용 시각적 피드백 컴포넌트.
 * 총구 화염(Muzzle Flash)과 총성(Gunshot Sound)을 전담합니다.
 */
export class FirearmEffectComponent extends BaseWeaponEffectComponent {
  private flashMaterial: StandardMaterial;
  private muzzleLight: PointLight;
  private gunshotSound: import('@babylonjs/core').Sound | undefined;

  private observer: import('@babylonjs/core').Nullable<
    import('@babylonjs/core').Observer<{
      weaponId: string;
      ownerId: string;
      ammoRemaining: number;
      fireType: 'firearm' | 'melee';
      muzzleTransform?: import('../../types/IWeapon').MuzzleTransform;
    }>
  > = null;

  constructor(owner: BasePawn, scene: Scene) {
    super(owner, scene);

    this.flashMaterial = new StandardMaterial('muzzleFlashMat', this.scene);
    this.flashMaterial.emissiveColor = new Color3(1, 1, 0.6);
    this.flashMaterial.disableLighting = true;

    this.muzzleLight = new PointLight('firearmEffectLight', Vector3.Zero(), this.scene);
    this.muzzleLight.range = 4;
    this.muzzleLight.diffuse = new Color3(1, 0.8, 0.4);
    this.muzzleLight.intensity = 0;

    this.gunshotSound = GameAssets.sounds.gunshot;

    // Subscribe to fire events
    this.observer = GameObservables.weaponFire.add((data) => {
      // Only react if this component's owner is the one who fired AND it is a firearm event
      if (data.ownerId === this.owner.id && data.fireType === 'firearm') {
        const isLocal = true; // For now, we use the same effect logic, but can differentiate
        this.playFireEffect(data.weaponId, data.muzzleTransform, isLocal);
      }
    });
  }

  private playFireEffect(
    _weaponId: string,
    muzzleTransform: import('../../types/IWeapon').MuzzleTransform | undefined,
    _isLocal: boolean
  ): void {
    if (muzzleTransform) {
      this.emitMuzzleFlash(
        muzzleTransform.position,
        muzzleTransform.direction,
        muzzleTransform.transformNode,
        muzzleTransform.localMuzzlePosition
      );
    }
    this.playGunshot();
  }

  public playGunshot(): void {
    const sound = this.gunshotSound || GameAssets.sounds.gunshot;
    if (sound) {
      this.gunshotSound = sound;

      // 피치(재생 속도)를 0.9 ~ 1.1 사이로 랜덤화
      const randomRate = 0.9 + Math.random() * 0.2;
      if (typeof (sound as any).setPlaybackRate === 'function') {
        sound.setPlaybackRate(randomRate);
      } else {
        (sound as any).playbackRate = randomRate;
      }
      sound.play();
    }
  }

  protected emitMuzzleFlash(
    position: Vector3,
    _direction: Vector3,
    transformNode?: import('@babylonjs/core').Node,
    localPosition?: Vector3
  ): void {
    const flash = MeshBuilder.CreateSphere('muzzleFlash', { diameter: 0.15 }, this.scene);
    flash.isPickable = false;
    flash.material = this.flashMaterial;
    // 초기화 (월드 원점)
    flash.position = Vector3.Zero();
    flash.rotation = Vector3.Zero();

    if (transformNode) {
      flash.parent = transformNode;
      if (localPosition) {
        // [DEBUG] 위치 확인용 로그
        flash.position.copyFrom(localPosition);
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const player = this.owner as any;
      if (player.camera) {
        flash.parent = player.camera;
        // 카메라 기준일 경우 월드 포지션을 로컬로 변환하거나(복잡),
        // 단순히 카메라 앞(Z+)으로 고정 배치
        flash.position = new Vector3(0, -0.1, 0.8);
      } else {
        flash.position = position;
      }
    }

    flash.rotation.z = Math.random() * Math.PI;
    flash.scaling.setAll(0.8 + Math.random() * 0.4);

    flash.computeWorldMatrix(true);

    this.muzzleLight.position.copyFrom(flash.absolutePosition);
    this.muzzleLight.intensity = 0.8;

    setTimeout(() => {
      flash.dispose();
      this.muzzleLight.intensity = 0;
    }, 60);
  }

  public dispose(): void {
    super.dispose();
    this.flashMaterial.dispose();
    this.muzzleLight.dispose();

    if (this.observer) {
      GameObservables.weaponFire.remove(this.observer);
      this.observer = null;
    }
  }
}
