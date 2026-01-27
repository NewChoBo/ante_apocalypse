import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  PointLight,
  Mesh,
  Observer,
  Sound,
  TransformNode,
} from '@babylonjs/core';
import { BaseWeaponEffectComponent } from './BaseWeaponEffectComponent';
import { AssetLoader } from '../../loaders/AssetLoader';
import { NetworkMediator } from '../../network/NetworkMediator';
import { CombatComponent } from './CombatComponent';
import { NetworkManager } from '../../network/NetworkManager';
import type { IPawn } from '../../../types/IPawn';
import { IFirearm, IWeapon } from '../../../types/IWeapon';
import { OnFiredPayload } from '../../network/NetworkProtocol';

/**
 * 총기류 전용 시각적 피드백 컴포넌트.
 * 총구 화염(Muzzle Flash)과 총성(Gunshot Sound)을 전담합니다.
 * Local Prediction과 Network Event를 모두 처리합니다.
 */
export class FirearmEffectComponent extends BaseWeaponEffectComponent {
  public name = 'FirearmEffect';
  private flashMaterial: StandardMaterial;
  private muzzleLight: PointLight;
  private gunshotSound: Sound | null = null;

  // Observers
  private networkObserver: Observer<OnFiredPayload> | null = null;
  private weaponObserver: Observer<IWeapon> | null = null;
  private weaponChangeObserver: Observer<IWeapon> | null = null;

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

    // 1. Remote Events (via NetworkMediator)
    this.networkObserver = NetworkMediator.getInstance().onFired.add((payload) => {
      // 내 캐릭터의 이벤트를 수신했을 때:
      // - Local Player라면 Prediction으로 이미 재생했으므로 무시.
      // - Remote Player라면 재생.
      if (payload.shooterId === this.owner.id) {
        if (this.isLocalPlayer()) {
          return; // Ignore self-echo
        }
      }

      // Remote Player firing (or me if checks passed)
      // Convert payload Position/Direction to Vector3
      if (payload.muzzleData) {
        const pos = new Vector3(
          payload.muzzleData.position.x,
          payload.muzzleData.position.y,
          payload.muzzleData.position.z
        );
        const dir = new Vector3(
          payload.muzzleData.direction.x,
          payload.muzzleData.direction.y,
          payload.muzzleData.direction.z
        );

        this.playEffect(payload.weaponId, {
          position: pos,
          direction: dir,
        });
      } else {
        this.playEffect(payload.weaponId);
      }
    });

    // 2. Local Prediction (via CombatComponent)
    if (this.isLocalPlayer()) {
      const combat = this.owner.getComponent(CombatComponent);
      if (combat) {
        // 초기 무기 바인딩
        this.bindWeapon(combat.getCurrentWeapon() as IFirearm);

        // 무기 교체 시 바인딩 갱신
        this.weaponChangeObserver = combat.onWeaponChanged.add((newWeapon: IWeapon) => {
          this.bindWeapon(newWeapon as IFirearm);
        });
      }
    }
  }

  private isLocalPlayer(): boolean {
    const myId = NetworkManager.getInstance().getSocketId();
    return this.owner.id === myId;
  }

  private bindWeapon(weapon: IFirearm): void {
    // Safety check: Ensure it's actually a Firearm (has muzzle transform)
    if (!weapon || !('getMuzzleTransform' in weapon)) {
      return;
    }

    if (weapon.onFirePredicted) {
      this.weaponObserver = weapon.onFirePredicted.add((w) => {
        // Double check in callback (though w should be the weapon itself)
        if ('getMuzzleTransform' in w) {
          const f = w as unknown as IFirearm;
          this.playEffect(f.name, f.getMuzzleTransform());
        }
      });
    }
  }

  public detach(): void {
    if (this.networkObserver) {
      NetworkMediator.getInstance().onFired.remove(this.networkObserver);
      this.networkObserver = null;
    }

    if (this.weaponObserver && (this.owner as any).getComponent(CombatComponent)) {
      const combat = this.owner.getComponent(CombatComponent);
      const currentWeapon = combat?.getCurrentWeapon();
      if (currentWeapon?.onFirePredicted) {
        currentWeapon.onFirePredicted.remove(this.weaponObserver);
      }
      this.weaponObserver = null;
    }

    if (this.weaponChangeObserver) {
      const combat = this.owner.getComponent(CombatComponent);
      combat?.onWeaponChanged.remove(this.weaponChangeObserver);
      this.weaponChangeObserver = null;
    }

    super.detach();
  }

  private playEffect(
    _weaponId: string,
    muzzleData?: {
      position: Vector3;
      direction: Vector3;
      transformNode?: TransformNode;
      localMuzzlePosition?: Vector3;
    }
  ): void {
    this.playGunshot();
    if (muzzleData) {
      this.emitMuzzleFlash(
        muzzleData.position,
        muzzleData.direction,
        muzzleData.transformNode,
        muzzleData.localMuzzlePosition
      );
    }
  }

  private playGunshot(): void {
    const sound = this.gunshotSound || AssetLoader.getInstance().getSound('gunshot');
    if (sound) {
      this.gunshotSound = sound;
      // 피치(재생 속도)를 0.9 ~ 1.1 사이로 랜덤화
      const randomRate = 0.9 + Math.random() * 0.2;

      try {
        if (typeof (sound as any).setPlaybackRate === 'function') {
          (sound as any).setPlaybackRate(randomRate);
        } else if ('playbackRate' in (sound as any)) {
          (sound as any).playbackRate = randomRate;
        }
      } catch (e) {
        console.warn('[FirearmEffectComponent] Failed to set playback rate:', e);
      }

      sound.play();
    }
  }

  protected emitMuzzleFlash(
    position: Vector3,
    _direction: Vector3,
    transformNode?: TransformNode,
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
      // Fallback: If local player, assume camera relative?
      // But we handled this in Firearm.getMuzzleTransform().
      // Here we just use what is passed.
      flash.position.copyFrom(position);
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
