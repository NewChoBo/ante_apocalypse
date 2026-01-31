import { Scene, Vector3, Color3, ParticleSystem, Texture } from '@babylonjs/core';
import { BaseComponent } from './BaseComponent';
import { BasePawn } from '../BasePawn';
import { AssetLoader } from '../AssetLoader';

/**
 * 발사 시 Muzzle Flash 이펙트를 담당하는 컴포넌트
 * RemotePlayerPawn에서 분리됨
 */
export class MuzzleFlashComponent extends BaseComponent {
  constructor(owner: BasePawn, scene: Scene) {
    super(owner, scene);
  }

  /**
   * 발사 사운드 재생
   */
  public playFireSound(): void {
    const sound = AssetLoader.getInstance().getSound('shoot');
    if (sound) {
      sound.play();
    }
  }

  /**
   * 지정된 위치에 Muzzle Flash 파티클 생성
   */
  public createFlash(position: Vector3): void {
    const particleSystem = new ParticleSystem('muzzleFlash', 10, this.scene);

    particleSystem.particleTexture = new Texture(
      'https://www.babylonjs-playground.com/textures/flare.png',
      this.scene
    );

    particleSystem.emitter = position;
    particleSystem.minEmitBox = new Vector3(0, 0, 0);
    particleSystem.maxEmitBox = new Vector3(0, 0, 0);

    particleSystem.color1 = new Color3(1, 1, 0.5).toColor4();
    particleSystem.color2 = new Color3(1, 0.5, 0).toColor4();

    particleSystem.minSize = 0.2;
    particleSystem.maxSize = 0.5;
    particleSystem.minLifeTime = 0.1;
    particleSystem.maxLifeTime = 0.2;

    particleSystem.emitRate = 100;
    particleSystem.targetStopDuration = 0.1;

    particleSystem.start();

    // Auto-dispose after effect completes
    setTimeout(() => particleSystem.dispose(), 500);
  }

  /**
   * 매 프레임 업데이트 (현재 사용하지 않음)
   */
  public update(_deltaTime: number): void {
    // No per-frame update needed
  }
}
