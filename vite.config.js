// vite.config.js
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
        { src: 'extension/manifest.json',       dest: 'dist'            },
        { src: 'extension/background.js',       dest: 'dist'            },
        // ← removed raw-copy of extension/content/*
        { src: 'extension/data/*.json',         dest: 'dist/data'       },
        { src: 'extension/icons/*',             dest: 'dist/icons'      },
        { src: 'extension/frontend/popup/**/*', dest: 'dist/frontend/popup' }
      ],
      verbose: true
    })
  ],
  build: {
    outDir: 'dist',
    minify: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'frontend/popup/index.html'),
        background: resolve(__dirname, 'extension/background.js'),
        // these will be bundled (with all imports inlined)
        'content/product': resolve(__dirname, 'extension/content/product.js'),
        'content/cart':    resolve(__dirname, 'extension/content/cart.js'),
        'content/orders':  resolve(__dirname, 'extension/content/orders.js')
      },
      output: {
        entryFileNames: chunk => {
          if (chunk.name === 'background') return 'background.js';
          if (chunk.name === 'popup')      return 'popup.js';
          if (chunk.name.startsWith('content/')) {
            // preserves content/product.js, content/cart.js, content/orders.js
            return `${chunk.name}.js`;
          }
          return 'assets/[name].js';
        },
        chunkFileNames:  'chunks/[name]-[hash].js',
        assetFileNames:  'assets/[name]-[hash][extname]'
      }
    },
    css: {
      devSourcemap: true
    }
  }
});
