// This file re-exports asset paths for convenient import if needed.
// However, direct imports like '@ante/assets/sounds/gunshot.wav' are also supported via package.json exports.

export const AssetPaths = {
  sounds: {
    gunshot: '@ante/assets/sounds/gunshot.wav',
    swipe: '@ante/assets/sounds/swipe.wav',
  },
  models: {
    enemy: '@ante/assets/models/dummy3.babylon',
    rifle: '@ante/assets/models/Gun.glb',
  },
  textures: {
    flare: '@ante/assets/textures/flare.png',
  },
};
