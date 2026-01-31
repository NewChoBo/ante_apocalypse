import {
  Scene,
  AssetContainer,
  SceneLoader,
  InstantiatedEntries,
  Mesh,
  CreateAudioEngineAsync,
  AudioEngineV2,
  Sound,
  Nullable,
} from '@babylonjs/core';
import '@babylonjs/loaders';
import { Logger } from '@ante/common';

import { settingsStore } from './store/SettingsStore';

// Asset Imports
import gunshotAsset from '../assets/sounds/gunshot.wav';
import swipeAsset from '../assets/sounds/swipe.wav';
import dummy3Asset from '../assets/models/dummy3.babylon';
import gunAsset from '../assets/models/Gun.glb';

const logger = new Logger('GameAssets');

/**
 * 게임의 모든 에셋을 정적으로 임포트하고 런타임 객체로 변환하여 보관하는 레지스트리.
 */
export class GameAssets {
  private static scene: Scene;
  private static audioEngine: AudioEngineV2 | null = null;

  // Sounds
  public static gunshot: Sound;
  public static swipe: Sound;

  // Models (Containers)
  private static modelContainers: Map<string, AssetContainer> = new Map();

  /**
   * 초기화: 엔진 및 기본 에셋 로드
   */
  public static async initialize(scene: Scene): Promise<void> {
    this.scene = scene;

    try {
      // 1. AudioEngine 초기화
      if (!this.audioEngine) {
        logger.info('Initializing AudioEngine...');
        this.audioEngine = await CreateAudioEngineAsync();
        if (this.audioEngine) {
          this.applyVolume(settingsStore.get().masterVolume);
          settingsStore.subscribe((state) => this.applyVolume(state.masterVolume));
        }
      }

      // 2. 모델 로드 (AssetContainer)
      logger.info('Preloading model containers...');
      await Promise.all([this.loadModel('enemy', dummy3Asset), this.loadModel('rifle', gunAsset)]);

      // 3. 사운드 로드
      if (this.audioEngine) {
        logger.info('Preloading sounds...');
        this.gunshot = (await this.audioEngine.createSoundAsync('gunshot', gunshotAsset, {
          volume: 0.5,
        })) as any;
        this.swipe = (await this.audioEngine.createSoundAsync('swipe', swipeAsset, {
          volume: 0.6,
        })) as any;
      }

      logger.info('GameAssets initialized successfully.');
    } catch (e) {
      logger.error('Failed to initialize GameAssets:', e);
    }
  }

  private static applyVolume(volume: number): void {
    if (this.audioEngine) {
      (this.audioEngine as any).volume = volume;
      if (typeof (this.audioEngine as any).setVolume === 'function') {
        (this.audioEngine as any).setVolume(volume);
      }
    }
  }

  private static async loadModel(key: string, asset: string): Promise<AssetContainer> {
    const container = await SceneLoader.LoadAssetContainerAsync('', asset, this.scene);
    this.modelContainers.set(key, container);
    return container;
  }

  /**
   * 캐시된 모델 컨테이너로부터 새 인스턴스 생성
   */
  public static instantiateModel(key: string, rootName?: string): Nullable<InstantiatedEntries> {
    const container = this.modelContainers.get(key);
    if (!container) {
      logger.error(`Model container not found: ${key}`);
      return null;
    }

    const entries = container.instantiateModelsToScene(
      (n) => (rootName ? `${rootName}_${n}` : n),
      false,
      { doNotInstantiate: true } // 클로닝 강제
    );

    // 단일 루트 노드 보장
    if (entries.rootNodes.length !== 1) {
      const scene = container.scene;
      const wrapper = new Mesh(rootName || `${key}_wrapper`, scene);
      entries.rootNodes.forEach((node) => {
        node.parent = wrapper;
      });
      (entries as any).rootNodes = [wrapper];
    }

    return entries;
  }

  public static resumeAudio(): void {
    this.audioEngine?.resumeAsync();
  }

  public static clear(): void {
    this.modelContainers.forEach((c) => c.dispose());
    this.modelContainers.clear();
  }
}
