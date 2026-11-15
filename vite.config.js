// Cake Factory – Sweet Automation · © 2026 Brakeco Games
import { defineConfig } from 'vite';

/** The import map in index.html is only for running without a bundler.
 *  The Vite build bundles Three.js from node_modules, so strip it. */
const stripDevImportMap = () => ({
  name: 'strip-dev-importmap',
  transformIndexHtml: {
    order: 'pre',
    handler: (html) => html.replace(/<script type="importmap" data-dev-only>[\s\S]*?<\/script>/, ''),
  },
});

export default defineConfig({
  base: './', // relative paths: works when hosted in a sub-directory (CrazyGames / Poki)
  plugins: [stripDevImportMap()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
