import { AudioEngineV2, CreateAudioEngineAsync, Sound } from '@babylonjs/core';
import { settingsStore } from '../store/SettingsStore';

export type AudioManifestItem = {
  key: string;
  asset: string;
  volume: number;
};

export class AudioAssetStore {
  public readonly sounds: Record<string, Sound> = {};
  private audioEngine: AudioEngineV2 | null = null;
  private settingsUnsubscribe: (() => void) | null = null;

  public async initialize(manifest: AudioManifestItem[]): Promise<void> {
    this.audioEngine = await CreateAudioEngineAsync();
    if (!this.audioEngine) return;

    const applyVolume = (volume: number): void => {
      if (!this.audioEngine) return;
      if (typeof this.audioEngine.setVolume === 'function') {
        this.audioEngine.setVolume(volume);
        return;
      }
      this.audioEngine.volume = volume;
    };

    applyVolume(settingsStore.get().masterVolume);
    this.settingsUnsubscribe = settingsStore.subscribe((state) => applyVolume(state.masterVolume));

    await Promise.all(
      manifest.map(async (item) => {
        if (!this.audioEngine) return;
        const sound = await this.audioEngine.createSoundAsync(item.key, item.asset, {
          volume: item.volume,
        });
        this.sounds[item.key] = sound as unknown as Sound;
      })
    );
  }

  public resume(): void {
    this.audioEngine?.resumeAsync();
  }

  public clear(): void {
    this.settingsUnsubscribe?.();
    this.settingsUnsubscribe = null;

    Object.values(this.sounds).forEach((sound) => sound.dispose());
    Object.keys(this.sounds).forEach((key) => delete this.sounds[key]);

    const disposableAudioEngine = this.audioEngine as AudioEngineV2 & { dispose?: () => void };
    disposableAudioEngine.dispose?.();
    this.audioEngine = null;
  }
}
