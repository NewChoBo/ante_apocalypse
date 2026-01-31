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
 * 에셋 유형별 보관소
 */
export const GameAssets = {
  scene: null as unknown as Scene,
  audioEngine: null as unknown as AudioEngineV2,

  // 에셋 접근용 네임스페이스
  sounds: {} as Record<string, Sound>,
  glb: {} as Record<string, AssetContainer>,
  babylon: {} as Record<string, AssetContainer>,

  /**
   * 초기화: 모든 에셋을 유형별로 자동 분류하여 로드
   */
  async initialize(scene: Scene): Promise<void> {
    this.scene = scene;

    try {
      // 1. Audio Engine
      this.audioEngine = await CreateAudioEngineAsync();
      if (this.audioEngine) {
        const applyVol = (v: number): void => {
          (this.audioEngine as any).volume = v;
          if (typeof (this.audioEngine as any).setVolume === 'function') {
            (this.audioEngine as any).setVolume(v);
          }
        };
        applyVol(settingsStore.get().masterVolume);
        settingsStore.subscribe((s) => applyVol(s.masterVolume));
      }

      // 2. Asset Manifest
      const manifest = [
        { key: 'gunshot', asset: gunshotAsset, type: 'sound', vol: 0.5 },
        { key: 'swipe', asset: swipeAsset, type: 'sound', vol: 0.6 },
        { key: 'enemy', asset: dummy3Asset, type: 'babylon' },
        { key: 'rifle', asset: gunAsset, type: 'glb' },
      ];

      logger.info('Preloading assets...');

      await Promise.all(
        manifest.map(async (item) => {
          if (item.type === 'sound') {
            if (!this.audioEngine) return;
            const s = await this.audioEngine.createSoundAsync(item.key, item.asset, {
              volume: item.vol,
            });
            this.sounds[item.key] = s as unknown as Sound;
          } else {
            const container = await SceneLoader.LoadAssetContainerAsync('', item.asset, this.scene);
            const targetMap = item.type === 'glb' ? this.glb : this.babylon;
            targetMap[item.key] = container;
          }
        })
      );

      logger.info('GameAssets initialized.');
    } catch (e) {
      logger.error('Failed to initialize GameAssets:', e);
    }
  },

  /**
   * 모델 인스턴스 생성 (GLB/Babylon 자동 판별)
   */
  instantiateModel(key: string, rootName?: string): Nullable<InstantiatedEntries> {
    const container = this.glb[key] || this.babylon[key];
    if (!container) {
      logger.error(`Model not found: ${key}`);
      return null;
    }

    const entries = container.instantiateModelsToScene(
      (n) => (rootName ? `${rootName}_${n}` : n),
      false,
      {
        doNotInstantiate: true,
      }
    );

    if (entries.rootNodes.length !== 1) {
      const wrapper = new Mesh(rootName || `${key}_wrapper`, this.scene);
      entries.rootNodes.forEach((node) => (node.parent = wrapper));
      (entries as any).rootNodes = [wrapper];
    }

    return entries;
  },

  resumeAudio(): void {
    this.audioEngine?.resumeAsync();
  },

  clear(): void {
    [this.glb, this.babylon].forEach((map) => {
      Object.values(map).forEach((c) => c.dispose());
    });
    Object.values(this.sounds).forEach((s) => s.dispose());
    this.sounds = {};
    this.glb = {};
    this.babylon = {};
  },
};
