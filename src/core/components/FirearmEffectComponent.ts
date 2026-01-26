import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  PointLight,
  Mesh,
  Observer,
} from '@babylonjs/core';
import { BaseWeaponEffectComponent } from './BaseWeaponEffectComponent';
import { AssetLoader } from '../AssetLoader';
import { GameObservables } from '../events/GameObservables';
import type { IPawn } from '../../types/IPawn';

/**
 * 총기류 전용 시각적 피드백 컴포넌트.
 * 총구 화염(Muzzle Flash)과 총성(Gunshot Sound)을 전담합니다.
 */
export class FirearmEffectComponent extends BaseWeaponEffectComponent {
  public name = 'FirearmEffect';
  private flashMaterial: StandardMaterial;
  private muzzleLight: PointLight;
  private gunshotSound: any;
  private fireObserver: Observer<any> | null = null;

  constructor(owner: IPawn, scene: Scene) {
    super(owner, scene);

    this.flashMaterial = new StandardMaterial('muzzleFlashMat', this.scene);
    this.flashMaterial.emissiveColor = new Color3(1, 1, 0.6);
    this.flashMaterial.disableLighting = true;

    this.muzzleLight = new PointLight('firearmEffectLight', Vector3.Zero(), this.scene);
    this.muzzleLight.range = 4;
    this.muzzleLight.diffuse = new Color3(1, 0.8, 0.4);
    this.muzzleLight.intensity = 0;

    this.gunshotSound = AssetLoader.getInstance().getSound('gunshot');
  }

  public attach(target: Mesh): void {
    super.attach(target);
    // 이벤트 구독: 'firearm' 타입인 경우에만 총구 화염 및 소리 발생
    this.fireObserver = GameObservables.weaponFire.add((payload) => {
      if (payload.fireType === 'firearm') {
        this.playGunshot();
        if (payload.muzzleTransform) {
          this.emitMuzzleFlash(
            payload.muzzleTransform.position,
            payload.muzzleTransform.direction,
            payload.muzzleTransform.transformNode,
            payload.muzzleTransform.localMuzzlePosition
          );
        }
      }
    });
  }

  public detach(): void {
    if (this.fireObserver) {
      GameObservables.weaponFire.remove(this.fireObserver);
      this.fireObserver = null;
    }
    super.detach();
  }

  private playGunshot(): void {
    const sound = this.gunshotSound || AssetLoader.getInstance().getSound('gunshot');
    if (sound) {
      this.gunshotSound = sound;
      // 피치(재생 속도)를 0.9 ~ 1.1 사이로 랜덤화
      const randomRate = 0.9 + Math.random() * 0.2;

      if (typeof sound.setPlaybackRate === 'function') {
        sound.setPlaybackRate(randomRate);
      } else if (typeof sound.setPitch === 'function') {
        sound.setPitch(randomRate);
      }

      sound.play();
    }
  }

  protected emitMuzzleFlash(
    position: Vector3,
    _direction: Vector3,
    transformNode?: any,
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
        flash.position.copyFrom(localPosition);
      }
    } else {
      const player = this.owner as any;
      if (player.camera) {
        flash.parent = player.camera;
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
  }
}
