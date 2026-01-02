import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // This only affects the warning threshold (not actual bundle size).
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id || typeof id !== 'string') return;

          const normalizedId = id.replaceAll('\\', '/');

          if (!normalizedId.includes('/node_modules/')) return;

          // React runtime (keep stable)
          if (
            normalizedId.includes('/node_modules/react/') ||
            normalizedId.includes('/node_modules/react-dom/') ||
            normalizedId.includes('/node_modules/scheduler/')
          ) {
            return 'react';
          }

          // Router (keep stable)
          if (
            normalizedId.includes('/node_modules/react-router') ||
            normalizedId.includes('/node_modules/history/')
          ) {
            return 'router';
          }

          // Three ecosystem (heavy)
          if (normalizedId.includes('/node_modules/three/')) return 'three';
          if (normalizedId.includes('/node_modules/@react-three/fiber/')) return 'r3f';
          if (normalizedId.includes('/node_modules/@react-three/drei/')) return 'drei';

          // Postprocessing (heavy, optional)
          if (
            normalizedId.includes('/node_modules/postprocessing/') ||
            normalizedId.includes('/node_modules/@react-three/postprocessing/')
          ) {
            return 'postprocessing';
          }

          // Everything else
          return 'vendor';
        },
      },
    },
  },
});
