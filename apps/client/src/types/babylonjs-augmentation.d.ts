import '@babylonjs/core';

declare module '@babylonjs/core' {
  interface Sound {
    /**
     * Set the playback rate of the sound
     */
    playbackRate: number;
    /**
     * Sets the playback rate of the sound
     */
    setPlaybackRate(rate: number): void;
  }

  interface AudioEngineV2 {
    /**
     * Global volume of the audio engine
     */
    volume: number;
    /**
     * Sets the global volume
     */
    setVolume(volume: number): void;
  }
}
