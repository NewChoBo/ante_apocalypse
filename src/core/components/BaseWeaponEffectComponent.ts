import { Scene, Vector3, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core';
import { BaseComponent } from './BaseComponent';
import { GameObservables } from '../events/GameObservables';
import type { IPawn } from '../../types/IPawn';

/**
 * 모든 무기 이펙트 컴포넌트의 추상 베이스 클래스.
 * 피격 스파크(hit sparks)와 같은 모든 무기 공통 연출을 담당합니다.
 */
export abstract class BaseWeaponEffectComponent extends BaseComponent {
  protected hitSparkMaterial: StandardMaterial;

  constructor(owner: IPawn, scene: Scene) {
    super(owner, scene);

    this.hitSparkMaterial = new StandardMaterial('hitSparkMat', this.scene);
    this.hitSparkMaterial.emissiveColor = new Color3(1, 0.8, 0.3);

    // 공통 이벤트: 모든 무기는 타겟 피격 시 스파크를 발생시킴
    GameObservables.targetHit.add((hitInfo) => {
      this.emitHitSpark(hitInfo.position);
    });
  }

  /** 탄환/칼날 피격 스파크 생성 (공통 기능) */
  protected emitHitSpark(position: Vector3): void {
    const spark = MeshBuilder.CreateSphere('hitSpark', { diameter: 0.05 }, this.scene);
    spark.position = position;
    spark.material = this.hitSparkMaterial;

    setTimeout(() => spark.dispose(), 80);
  }

  public update(_deltaTime: number): void {
    // 하위 클래스에서 필요시 구현
  }

  public dispose(): void {
    super.dispose();
    if (this.hitSparkMaterial) {
      this.hitSparkMaterial.dispose();
    }
  }
}
