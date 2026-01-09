import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, cpSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-extension-files',
      closeBundle() {
        // Copy manifest.json
        copyFileSync('manifest.json', 'dist/manifest.json');
        // Copy offscreen.html
        copyFileSync('offscreen.html', 'dist/offscreen.html');
        // Create icons directory and copy icons
        mkdirSync('dist/icons', { recursive: true });
        copyFileSync('icons/icon16.jpeg', 'dist/icons/icon16.jpeg');
        copyFileSync('icons/icon32.jpeg', 'dist/icons/icon32.jpeg');
        copyFileSync('icons/icon48.jpeg', 'dist/icons/icon48.jpeg');
        copyFileSync('icons/icon128.jpeg', 'dist/icons/icon128.jpeg');
        // Copy circuits from SDK package dist
        const circuitsSource = resolve(__dirname, '../../dist/circuits');
        cpSync(circuitsSource, 'dist/circuits', { recursive: true });
        console.log('[Extension] Copied circuit files from SDK');
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content.ts'),
        offscreen: resolve(__dirname, 'src/offscreen.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: (chunkInfo) => {
          // Avoid underscore prefix for chunk names
          const name = chunkInfo.name.replace(/^_/, 'vendor-');
          return `${name}-[hash].js`;
        },
        assetFileNames: '[name].[ext]',
        manualChunks: undefined, // Disable automatic chunking to avoid _commonjsHelpers
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    minify: false,
  },
});
