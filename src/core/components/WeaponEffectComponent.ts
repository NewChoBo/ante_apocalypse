import { Scene, Vector3, MeshBuilder, StandardMaterial, Color3, PointLight } from '@babylonjs/core';
import { BaseComponent } from './BaseComponent';
import { AssetLoader } from '../AssetLoader';
import { GameObservables } from '../events/GameObservables.ts';
import type { BasePawn } from '../BasePawn';

/**
 * 무기의 모든 시각적 피드백(총구 화염, 피격 이펙트 등)을 전담하는 컴포넌트.
 */
export class WeaponEffectComponent extends BaseComponent {
  private flashMaterial: StandardMaterial;
  private hitSparkMaterial: StandardMaterial;
  private muzzleLight: PointLight;
  private gunshotSound: any;
  private swipeSound: any;

  constructor(owner: BasePawn, scene: Scene) {
    super(owner, scene);

    // 공용 재질 및 광원 미리 생성 (셰이더 컴파일 지연 방지)
    this.flashMaterial = new StandardMaterial('muzzleFlashMat', this.scene);
    this.flashMaterial.emissiveColor = new Color3(1, 1, 0.6);
    this.flashMaterial.disableLighting = true;

    this.hitSparkMaterial = new StandardMaterial('hitSparkMat', this.scene);
    this.hitSparkMaterial.emissiveColor = new Color3(1, 0.8, 0.3);

    this.muzzleLight = new PointLight('weaponEffectLight', Vector3.Zero(), this.scene);
    this.muzzleLight.range = 4;
    this.muzzleLight.diffuse = new Color3(1, 0.8, 0.4);

    // 사운드 가져오기
    this.gunshotSound = AssetLoader.getInstance().getSound('gunshot');
    this.swipeSound = AssetLoader.getInstance().getSound('swipe');

    // 이벤트 구독 (구조 강화: 이펙트 컴포넌트가 발사 이벤트를 직접 듣고 연출 수행)
    GameObservables.weaponFire.add((payload) => {
      if (payload.weaponId === 'Knife') {
        this.playSwipe();
      } else {
        this.playGunshot();
        if (payload.muzzleTransform) {
          this.emitMuzzleFlash(
            payload.muzzleTransform.position,
            payload.muzzleTransform.direction,
            payload.muzzleTransform.transformNode
          );
        }
      }
    });

    // 피격 이펙트 구독
    GameObservables.targetHit.add((hitInfo) => {
      this.emitHitSpark(hitInfo.position);
    });
  }

  /** 총성 재생 */
  private playGunshot(): void {
    const sound = this.gunshotSound || AssetLoader.getInstance().getSound('gunshot');
    if (sound) {
      this.gunshotSound = sound;
      sound.play();
    }
  }

  /** 휘두르기 사운드 재생 */
  private playSwipe(): void {
    const sound = this.swipeSound || AssetLoader.getInstance().getSound('swipe');
    if (sound) {
      this.swipeSound = sound;
      sound.play();
    }
  }

  /** 총구 화염 이펙트 실행 */
  public emitMuzzleFlash(position: Vector3, _direction: Vector3, transformNode?: any): void {
    const flash = MeshBuilder.CreateSphere('muzzleFlash', { diameter: 0.15 }, this.scene);
    flash.isPickable = false;
    flash.material = this.flashMaterial;

    // 위치 설정 후 부모를 설정하여 연동 (setParent는 월드 위치 유지하며 로컬값 자동 계산)
    flash.position = position;
    if (transformNode) {
      flash.setParent(transformNode);
    } else {
      const player = this.owner as any;
      if (player.camera) {
        flash.setParent(player.camera);
      }
    }

    // 시각적 다양성 추가
    flash.rotation.z = Math.random() * Math.PI;
    flash.scaling.setAll(0.8 + Math.random() * 0.4);

    // 조명 활성화
    flash.computeWorldMatrix(true);
    this.muzzleLight.position.copyFrom(flash.absolutePosition);
    this.muzzleLight.intensity = 0.8;

    setTimeout(() => {
      flash.dispose();
      this.muzzleLight.intensity = 0;
    }, 60);
  }

  /** 탄환 피격 스파크 생성 */
  public emitHitSpark(position: Vector3): void {
    const spark = MeshBuilder.CreateSphere('hitSpark', { diameter: 0.05 }, this.scene);
    spark.position = position;
    spark.material = this.hitSparkMaterial;

    setTimeout(() => spark.dispose(), 80);
  }

  /** 매 프레임 업데이트 (필요 시 애니메이션 보간 등 수행) */
  public update(_deltaTime: number): void {
    // 시각적 효과 업데이트가 필요할 경우 여기에 구현
  }

  public dispose(): void {
    super.dispose();
    this.flashMaterial.dispose();
    this.hitSparkMaterial.dispose();
    this.muzzleLight.dispose();
  }
}
