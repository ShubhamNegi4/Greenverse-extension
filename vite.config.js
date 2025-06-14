import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  // Copy everything in `extension/` straight through to `dist/`
  publicDir: 'extension',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'frontend/popup/index.html'),
      }
    }
  }
});