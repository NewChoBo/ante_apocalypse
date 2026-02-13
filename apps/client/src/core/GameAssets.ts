import {
  AssetContainer,
  InstantiatedEntries,
  Nullable,
  Scene,
  Sound,
  Texture,
} from '@babylonjs/core';
import '@babylonjs/loaders';
import { Logger } from '@ante/common';

import gunshotAsset from '@ante/assets/sounds/gunshot.wav';
import swipeAsset from '@ante/assets/sounds/swipe.wav';
import dummy3Asset from '@ante/assets/models/dummy3.babylon';
import gunAsset from '@ante/assets/models/Gun.glb';
import flareAsset from '@ante/assets/textures/flare.png';
import { AssetRegistry } from './assets/AssetRegistry';
import { AudioAssetStore } from './assets/AudioAssetStore';

const logger = new Logger('GameAssets');

const audioStore = new AudioAssetStore();
const assetRegistry = new AssetRegistry();

export const GameAssets = {
  scene: null as Scene | null,
  isInitialized: false,

  get sounds(): Record<string, Sound> {
    return audioStore.sounds;
  },

  get glb(): Record<string, AssetContainer> {
    return assetRegistry.glb;
  },

  get babylon(): Record<string, AssetContainer> {
    return assetRegistry.babylon;
  },

  get textures(): Record<string, Texture> {
    return assetRegistry.textures;
  },

  async initialize(scene: Scene): Promise<void> {
    if (this.isInitialized && this.scene === scene) {
      return;
    }

    this.clear();
    this.scene = scene;

    try {
      await Promise.all([
        audioStore.initialize([
          { key: 'gunshot', asset: gunshotAsset, volume: 0.5 },
          { key: 'swipe', asset: swipeAsset, volume: 0.6 },
        ]),
        assetRegistry.load(scene, [
          { key: 'flare', asset: flareAsset, type: 'texture' },
          { key: 'enemy', asset: dummy3Asset, type: 'babylon' },
          { key: 'rifle', asset: gunAsset, type: 'glb' },
        ]),
      ]);

      this.isInitialized = true;
      logger.info('GameAssets initialized.');
    } catch (e) {
      logger.error('Failed to initialize GameAssets:', e);
      this.clear();
    }
  },

  instantiateModel(key: string, rootName?: string): Nullable<InstantiatedEntries> {
    return assetRegistry.instantiateModel(this.scene, key, rootName);
  },

  resumeAudio(): void {
    audioStore.resume();
  },

  clear(): void {
    audioStore.clear();
    assetRegistry.clear();
    this.scene = null;
    this.isInitialized = false;
  },
};
