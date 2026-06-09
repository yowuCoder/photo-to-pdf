import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Generates relative paths for assets, making it compatible with GitHub Pages subfolder URLs
  build: {
    outDir: 'dist',
  }
});
