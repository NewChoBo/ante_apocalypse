import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  base: './', // GitHub Pages 배포를 위해 상대 경로 사용
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  esbuild: {
    pure: ['console.log', 'console.debug'],
  },
});
