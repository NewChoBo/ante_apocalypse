import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // GitHub Pages 배포를 위해 상대 경로 사용
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  esbuild: {
    pure: ['console.log', 'console.debug'],
  },
});
