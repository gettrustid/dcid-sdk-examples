import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, cpSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-extension-files',
      writeBundle() {
        const srcDir = resolve(__dirname);
        const distDir = resolve(__dirname, 'dist');
        // Ensure dist directory exists
        mkdirSync(distDir, { recursive: true });
        // Copy manifest.json
        copyFileSync(resolve(srcDir, 'manifest.json'), resolve(distDir, 'manifest.json'));
        // Copy offscreen.html
        copyFileSync(resolve(srcDir, 'offscreen.html'), resolve(distDir, 'offscreen.html'));
        // Create icons directory and copy icons
        mkdirSync(resolve(distDir, 'icons'), { recursive: true });
        copyFileSync(resolve(srcDir, 'icons/icon16.jpeg'), resolve(distDir, 'icons/icon16.jpeg'));
        copyFileSync(resolve(srcDir, 'icons/icon32.jpeg'), resolve(distDir, 'icons/icon32.jpeg'));
        copyFileSync(resolve(srcDir, 'icons/icon48.jpeg'), resolve(distDir, 'icons/icon48.jpeg'));
        copyFileSync(resolve(srcDir, 'icons/icon128.jpeg'), resolve(distDir, 'icons/icon128.jpeg'));
        // Copy circuits from SDK package dist
        const circuitsSource = resolve(__dirname, '../../dcid-sdk/dist/circuits');
        cpSync(circuitsSource, resolve(distDir, 'circuits'), { recursive: true });
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
      external: [
        // React Native modules (not available in browser extension)
        'react-native-fs',
        'react-native-mmkv',
        'react-native',
        '@react-native-async-storage/async-storage',
        'react-native-keychain',
        'react-native-device-info',
        'react-native-jailbreak-detection',
      ],
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
