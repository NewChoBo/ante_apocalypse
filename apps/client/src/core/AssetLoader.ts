import {
  Scene,
  CreateAudioEngineAsync,
  SceneLoader,
  AssetContainer,
  InstantiatedEntries,
  Mesh,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { Logger } from '@ante/common';
import { settingsStore } from './store/SettingsStore';

const logger = new Logger('AssetLoader');

import gunshotUrl from '../assets/sounds/gunshot.wav';
import swipeUrl from '../assets/sounds/swipe.wav';
import dummy3Url from '../assets/models/dummy3.babylon?url';
import gunUrl from '../assets/models/Gun.glb?url';

// Audio V2 타입을 위해 가져옵니다.
import type { AudioEngineV2 } from '@babylonjs/core';

/**
 * 게임 에셋을 중앙에서 관리하고 미리 로드하는 싱글톤 클래스.
 * 오디오 및 3D 모델(Mesh)의 프리로딩과 인스턴싱을 담당합니다.
 */
export class AssetLoader {
  private static instance: AssetLoader;
  private sounds: Map<string, any> = new Map();
  private containers: Map<string, AssetContainer> = new Map();
  private isLoaded = false;
  private lastScene: Scene | null = null;
  private loadingPromise: Promise<void> | null = null;
  private audioEngine: AudioEngineV2 | null = null;

  private currentLoadId = 0;

  private constructor() {}

  public static getInstance(): AssetLoader {
    if (!AssetLoader.instance) {
      AssetLoader.instance = new AssetLoader();
    }
    return AssetLoader.instance;
  }

  /**
   * 캐시된 에셋을 모두 해제하고 상태를 초기화합니다.
   */
  public clear(): void {
    const id = this.currentLoadId;
    logger.info(`[Load#${id}] Cleaning up cache for scene change...`);
    this.containers.forEach((container, key) => {
      logger.info(`[Load#${id}] Disposing container: ${key}`);
      container.dispose();
    });
    this.containers.clear();
    this.sounds.forEach((sound, key) => {
      logger.info(`[Load#${id}] Disposing sound: ${key}`);
      sound.dispose();
    });
    this.sounds.clear();
    this.isLoaded = false;
    this.lastScene = null;
    // Note: We don't nullify loadingPromise here to avoid breaking active waiters.
  }

  /**
   * 에셋 로딩 초기화 및 시작.
   * 씬이 바뀌었으면 자동으로 이전 데이터를 정리하고 새로 로드합니다.
   */
  public async load(scene: Scene): Promise<void> {
    // 이미 로딩 중인 약속이 있다면 그것을 기다립니다.
    if (this.loadingPromise) {
      logger.info(
        `Waiting for active loading session (current scene: ${this.lastScene?.uniqueId || 'unknown'})`
      );
      await this.loadingPromise;
    }

    // 필수 에셋 존재 여부 확인
    const requiredAssets = ['enemy', 'rifle'];
    const allContainersPresent = requiredAssets.every((key) => this.containers.has(key));

    // 로딩이 완료되었고 같은 씬이며 모든 데이터가 있다면 바로 리턴
    if (this.isLoaded && this.lastScene === scene && allContainersPresent) {
      logger.info(`Assets already loaded and valid for Scene#${scene.uniqueId}.`);
      return;
    }

    // 씬이 바뀌었거나 로드가 안 된 경우 새로 시작
    this.loadingPromise = this._executeLoad(scene);
    try {
      await this.loadingPromise;
    } finally {
      this.loadingPromise = null;
    }
  }

  private async _executeLoad(scene: Scene): Promise<void> {
    const id = ++this.currentLoadId;
    const sceneId = scene.uniqueId;

    // 씬 전환 감지 및 초기화
    if (this.lastScene && this.lastScene !== scene) {
      logger.info(
        `[Load#${id}] Transition detected: Scene#${this.lastScene.uniqueId} -> Scene#${sceneId}. Resetting cache.`
      );
      this.clear();
      this.currentLoadId = id; // clear()에서 초기화된 ID 복구
    }

    this.lastScene = scene;
    logger.info(`[Load#${id}] Starting preload on Scene#${sceneId}`);
    const startTime = performance.now();

    try {
      // 1. Audio Engine Init
      if (!this.audioEngine) {
        logger.info(`[Load#${id}] Initializing AudioEngine...`);
        this.audioEngine = await CreateAudioEngineAsync();

        // Apply initial volume
        const currentSettings = settingsStore.get();
        if (this.audioEngine) {
          const v2 = this.audioEngine as any;
          v2.volume = currentSettings.masterVolume;
          if (typeof v2.setVolume === 'function') {
            v2.setVolume(currentSettings.masterVolume);
          }
        }

        // Subscribe to volume changes
        settingsStore.subscribe((state) => {
          if (this.audioEngine) {
            const v2 = this.audioEngine as any;
            v2.volume = state.masterVolume;
            if (typeof v2.setVolume === 'function') {
              v2.setVolume(state.masterVolume);
            }
          }
        });
      }

      if (scene.isDisposed) throw new Error('Scene disposed during audio initialization');

      // 2. Load Sounds
      if (this.sounds.size === 0) {
        logger.info(`[Load#${id}] Loading default sound effects...`);
        const gunshotSound = await this.audioEngine.createSoundAsync('gunshot', gunshotUrl, {
          volume: 0.5,
        });
        this.sounds.set('gunshot', gunshotSound);

        try {
          const swipeSound = await this.audioEngine.createSoundAsync('swipe', swipeUrl, {
            volume: 0.6,
          });
          this.sounds.set('swipe', swipeSound);
        } catch {
          logger.warn(`[Load#${id}] Non-critical sound "swipe" failed.`);
        }
      }

      if (scene.isDisposed) throw new Error('Scene disposed during sound loading');

      // 3. Load Mesh Containers
      logger.info(`[Load#${id}] Loading model containers for Scene#${sceneId}...`);
      await Promise.all([
        this.loadMeshToContainer(scene, 'enemy', '', dummy3Url),
        this.loadMeshToContainer(scene, 'rifle', '', gunUrl),
      ]);

      if (scene.isDisposed) throw new Error('Scene disposed during mesh loading');

      // 최종 확인
      const requiredAssets = ['enemy', 'rifle'];
      const success = requiredAssets.every((key) => this.containers.has(key));

      if (success) {
        this.isLoaded = true;
        logger.info(
          `[Load#${id}] Successfully preloaded Scene#${sceneId} in ${(performance.now() - startTime).toFixed(2)}ms.`
        );
      } else {
        throw new Error('Some critical assets failed to load into containers.');
      }
    } catch (e) {
      logger.error(`[Load#${id}] FAILED loading Scene#${sceneId}: ${e}`);
      this.isLoaded = false;
      throw e;
    } finally {
      this.loadingPromise = null;
    }
  }

  /**
   * 특정 모델을 AssetContainer로 로드하여 캐싱
   */
  private async loadMeshToContainer(
    scene: Scene,
    key: string,
    rootUrl: string,
    fileName: string
  ): Promise<void> {
    const id = this.currentLoadId;
    try {
      logger.info(`[Load#${id}] [${key}] Fetching from ${rootUrl}${fileName}`);
      const container = await SceneLoader.LoadAssetContainerAsync(rootUrl, fileName, scene);
      this.containers.set(key, container);
    } catch (e) {
      logger.error(`[Load#${id}] [${key}] Load FAILED: ${e}`);
      throw e;
    }
  }

  /**
   * 캐시된 컨테이너에서 메쉬 인스턴스를 생성 (복제)
   * @param name 에셋 키 이름 (e.g. 'enemy', 'rifle')
   * @param rootName 인스턴스 루트 노드의 이름 (Optional)
   */
  public instantiateMesh(name: string, rootName?: string): InstantiatedEntries | null {
    const container = this.containers.get(name);
    if (!container) {
      logger.error(
        `Critical: Cache miss for asset "${name}". isLoaded=${this.isLoaded}, containerCount=${this.containers.size}`
      );
      return null;
    }

    // instantiateModelsToScene creates clones of the meshes/skeletons/anims
    const entries = container.instantiateModelsToScene(
      (n) => (rootName ? `${rootName}_${n}` : n),
      false,
      { doNotInstantiate: true } // FORCE CLONE: Required for skeletal animation
    );

    // Ensure we always return a single root node for the caller to grab (at index 0)
    if (entries.rootNodes.length !== 1) {
      // Access scene via any mesh or the container's scene property
      const scene = (container as any).scene;
      const wrapper = new Mesh(rootName || `${name}_wrapper`, scene);
      entries.rootNodes.forEach((node) => {
        node.parent = wrapper;
      });
      (entries as any).rootNodes = [wrapper];
    }

    return entries;
  }

  public getSound(name: string): any {
    return this.sounds.get(name);
  }

  public getAudioEngine(): AudioEngineV2 | null {
    return this.audioEngine;
  }

  public get ready(): boolean {
    return this.isLoaded;
  }
}
