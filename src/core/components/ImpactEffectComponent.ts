import { Scene, Vector3, ParticleSystem, Texture, Color4, Mesh, Observer } from '@babylonjs/core';
import { BaseComponent } from './BaseComponent';
import { GameObservables } from '../events/GameObservables';
import type { IPawn } from '../../types/IPawn';
import flareUrl from '../../assets/textures/Flare.png?url';

/**
 * 타격 이펙트(Impact)를 담당하는 컴포넌트.
 * 타겟 피격 시 파티클 시스템을 생성합니다.
 */
export class ImpactEffectComponent extends BaseComponent {
  public name = 'ImpactEffect';
  private particleSystem: ParticleSystem;
  private hitObserver: Observer<any> | null = null;

  constructor(owner: IPawn, scene: Scene) {
    super(owner, scene);

    // 파티클 시스템 미리 생성 (풀링 방식이 이상적이나 간소화)
    this.particleSystem = this.createParticleSystem();
  }

  public attach(target: Mesh): void {
    super.attach(target);
    // 모든 표면 타격 이벤트 구독 (타겟 포함)
    this.hitObserver = GameObservables.hitEffect.add((info) => {
      this.playHitEffect(info.position);
    });
  }

  public detach(): void {
    if (this.hitObserver) {
      GameObservables.hitEffect.remove(this.hitObserver);
      this.hitObserver = null;
    }
    super.detach();
  }

  public update(_deltaTime: number): void {
    // 업데이트 로직 없음
  }

  private createParticleSystem(): ParticleSystem {
    // 텍스처 없이 포인트 입자 사용 가능하도록 설정하거나 기본 텍스처 사용
    const ps = new ParticleSystem('impactParticles', 100, this.scene);
    ps.particleTexture = new Texture(flareUrl, this.scene);

    ps.emitter = Vector3.Zero(); // 나중에 위치 설정
    ps.minEmitPower = 1;
    ps.maxEmitPower = 3;
    ps.updateSpeed = 0.02;

    // 노란색/주황색 스파크
    ps.color1 = new Color4(1, 1, 0.8, 1);
    ps.color2 = new Color4(1, 0.5, 0, 1);
    ps.colorDead = new Color4(0.5, 0, 0, 0);

    ps.minSize = 0.05;
    ps.maxSize = 0.15;
    ps.minLifeTime = 0.2;
    ps.maxLifeTime = 0.5;

    ps.emitRate = 0; // 수동 발사
    ps.manualEmitCount = 0;
    ps.blendMode = ParticleSystem.BLENDMODE_ONEONE;

    ps.gravity = new Vector3(0, -9.81, 0);
    ps.direction1 = new Vector3(-1, 1, -1);
    ps.direction2 = new Vector3(1, 1, 1);

    ps.start();

    return ps;
  }

  private playHitEffect(position: Vector3): void {
    // 파티클 위치 설정 및 발사
    this.particleSystem.emitter = position;
    this.particleSystem.manualEmitCount = 10; // 10개 파티클 방출
  }

  public dispose(): void {
    super.dispose();
    this.particleSystem.dispose();
  }
}
