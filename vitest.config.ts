import { defineConfig } from 'vitest/config';

export default defineConfig({
  assetsInclude: ['**/*.glb', '**/*.babylon', '**/*.env', '**/*.wav', '**/*.png'],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['**/*.{test,spec}.{ts,js}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
