import { defineConfig } from 'vite';

export default defineConfig({
  envDir: '../../',
  base: './', // GitHub Pages 배포를 위해 상대 경로 사용
  assetsInclude: ['**/*.glb', '**/*.babylon', '**/*.env', '**/*.wav'],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
