import { Scene, CreateAudioEngineAsync } from '@babylonjs/core';

// Audio V2 타입을 위해 가져옵니다.
import type { AudioEngineV2 } from '@babylonjs/core';

/**
 * 게임 에셋을 중앙에서 관리하고 미리 로드하는 싱글톤 클래스.
 */
export class AssetLoader {
  private static instance: AssetLoader;
  private sounds: Map<string, any> = new Map();
  private isLoaded = false;
  private audioEngine: AudioEngineV2 | null = null;

  private constructor() {}

  public static getInstance(): AssetLoader {
    if (!AssetLoader.instance) {
      AssetLoader.instance = new AssetLoader();
    }
    return AssetLoader.instance;
  }

  /**
   * 에셋 로딩 초기화 및 시작.
   */
  public async load(_scene: Scene): Promise<void> {
    if (this.isLoaded) return;

    try {
      this.audioEngine = await CreateAudioEngineAsync();

      const gunshotSound = await this.audioEngine.createSoundAsync(
        'gunshot',
        '/sounds/gunshot.wav',
        {
          volume: 0.5,
        }
      );
      this.sounds.set('gunshot', gunshotSound);

      try {
        const swipeSound = await this.audioEngine.createSoundAsync('swipe', '/sounds/swipe.wav', {
          volume: 0.6,
        });
        this.sounds.set('swipe', swipeSound);
      } catch (e) {
        console.warn('Swipe sound not found, placeholder used.');
      }

      this.isLoaded = true;
    } catch (e) {
      console.error('Failed to preload assets:', e);
      this.isLoaded = true;
    }
  }

  /**
   * 미리 로드된 사운드 반환.
   */
  public getSound(name: string): any {
    return this.sounds.get(name);
  }

  /**
   * 오디오 엔진 반환.
   */
  public getAudioEngine(): AudioEngineV2 | null {
    return this.audioEngine;
  }

  public get ready(): boolean {
    return this.isLoaded;
  }
}
