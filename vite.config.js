import { defineConfig } from 'vite';

// Relative base so the build runs from any folder (and later inside Electron).
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1000 }, // three.js is one ~600 kB chunk; fine for a desktop game
});
