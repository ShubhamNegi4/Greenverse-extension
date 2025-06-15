// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import copy  from 'rollup-plugin-copy';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  plugins: [
    react(),

    copy({
      hook: 'writeBundle',
      targets: [
        // 1) manifest at dist/manifest.json
        { src: 'extension/manifest.json', dest: 'dist' },

        // 2) icons/* → dist/icons/
        { src: 'extension/icons/*',      dest: 'dist/icons' },

        // 3) data/*.json → dist/data/
        { src: 'extension/data/*',       dest: 'dist/data' },

        // 4) popup HTML template → dist/frontend/popup
        { src: 'frontend/popup/index.html', dest: 'dist/frontend/popup' },
      ]
    })
  ],

  build: {
    outDir: 'dist',
    minify: false,
    rollupOptions: {
      // treat these as entry points so Vite bundles them
      input: {
        popup:      resolve(__dirname, 'frontend/popup/index.html'),
        background: resolve(__dirname, 'extension/background.js'),
        product:    resolve(__dirname, 'extension/content/product.js'),
        cart:       resolve(__dirname, 'extension/content/cart.js'),
      },
      output: {
        entryFileNames: chunk => {
          switch (chunk.name) {
            case 'background':
              return 'background.js';
            case 'product':
              return 'content/product.js';
            case 'cart':
              return 'content/cart.js';
            case 'popup':
              // Vite will inject <script src="./popup.js"> into index.html
              // so emit popup.js alongside it:
              return 'frontend/popup/popup.js';
            default:
              return '[name].js';
          }
        },
        chunkFileNames:  'chunks/[name]-[hash].js',
        assetFileNames:  'assets/[name]-[hash][extname]',
      }
    }
  }
});
