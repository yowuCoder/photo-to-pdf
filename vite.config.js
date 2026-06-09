import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Generates relative paths for assets, making it compatible with GitHub Pages subfolder URLs
  build: {
    outDir: 'dist',
  }
});
