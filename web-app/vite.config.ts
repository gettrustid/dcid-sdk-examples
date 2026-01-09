import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { cpSync, mkdirSync, existsSync } from 'fs';

// Circuits are bundled with the SDK package
const circuitsSource = resolve(__dirname, '../../dist/circuits');

function copyCircuits(targetDir: string) {
  try {
    if (!existsSync(circuitsSource)) {
      console.warn(`[circuits] Source not found at ${circuitsSource}, skipping copy`);
      return;
    }
    mkdirSync(targetDir, { recursive: true });
    cpSync(circuitsSource, targetDir, { recursive: true });
    console.log(`[circuits] Copied circuits from SDK to ${targetDir}`);
  } catch (err) {
    console.warn('[circuits] Failed to copy circuits:', err);
  }
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-circuits',
      buildStart() {
        // Make circuits available during dev under public/circuits
        copyCircuits(resolve(__dirname, 'public/circuits'));
      },
      closeBundle() {
        // Ensure circuits are in the build output for production
        copyCircuits(resolve(__dirname, 'dist/circuits'));
      },
    },
  ],
  assetsInclude: ['**/*.wasm', '**/*.zkey', '**/*.json'],
  server: {
    port: 3000,
    fs: {
      // Allow serving files from the circuits directory
      allow: ['..'],
    },
  },
  optimizeDeps: {
    exclude: ['@custom-0xpolygonid/js-sdk', 'js-iden3-auth-custom', 'snarkjs'],
    esbuildOptions: {
      // Needed for top-level await in WASM loading
      target: 'esnext',
    },
  },
});
