import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import copy from 'rollup-plugin-copy';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    copy({
      hook: 'writeBundle',
      targets: [
        { 
          src: 'extension/manifest.json', 
          dest: 'dist' 
        },
        { 
          src: 'extension/icons/*', 
          dest: 'dist/icons' 
        },
        { 
          src: 'extension/data/*.json', 
          dest: 'dist/data' 
        }
      ]
    })
  ],
  build: {
    outDir: 'dist',
    minify: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'frontend/popup/index.html'),
        background: resolve(__dirname, 'extension/background.js'),
        'content/product': resolve(__dirname, 'extension/content/product.js'),
        'content/cart': resolve(__dirname, 'extension/content/cart.js')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background.js';
          if (chunkInfo.name === 'popup') return 'popup.js';
          if (chunkInfo.name.startsWith('content/')) {
            return `${chunkInfo.name}.js`;
          }
          return 'assets/[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    },
    // Add this to ignore CSS errors during build
    css: {
      devSourcemap: true
    }
  }
});