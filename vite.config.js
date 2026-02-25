import { defineConfig } from 'vite';

export default defineConfig({
  base: '/goosegame/',
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
  },
  server: {
    open: true,
  },
});
