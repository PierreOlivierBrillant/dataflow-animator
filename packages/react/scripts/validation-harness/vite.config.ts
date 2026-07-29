import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Visual validation harness: Vite serves THIS folder at the root and resolves
// the package sources directly (Stage, clipOpacity, easeInOutCubic are
// NOT publicly exported — we import them from src to remain faithful
// to the real render without polluting the public API). No added dependencies:
// vite + @vitejs/plugin-react are already devDeps of the package.
export default defineConfig({
  root: import.meta.dirname,
  // PORT lets a second harness run alongside one already holding 5199 (two
  // sessions, or a side-by-side before/after comparison of a routing change).
  server: { open: false, port: Number(process.env.PORT) || 5199 },
  resolve: {
    alias: {
      '@dataflow-animator/core': fileURLToPath(
        new URL('../../../core/src', import.meta.url)
      ),
    },
  },
  plugins: [react()],
});
