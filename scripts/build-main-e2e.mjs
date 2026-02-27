/**
 * Builds the Electron main + preload processes for e2e testing.
 *
 * electron-forge's VitePlugin handles this automatically during `start` or
 * `package`, but Playwright e2e tests need the built output without launching
 * the packaged app. This script replicates the forge build step so CI can
 * build `.vite/build/index.js` (main) and `.vite/build/preload.js` (preload)
 * before running `npx playwright test`.
 *
 * MAIN_WINDOW_VITE_DEV_SERVER_URL is set to http://localhost:5173 so the main
 * process connects to the Vite dev server that Playwright's webServer starts.
 */

import { build } from 'vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { builtinModules } from 'node:module'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const builtins = [
  'electron',
  'electron/common',
  'electron/main',
  'electron/renderer',
  ...builtinModules.flatMap((m) => [m, `node:${m}`]),
]

// Packages that must stay external (native addons + large deps loaded at runtime)
const mainExternals = [
  ...builtins,
  'better-sqlite3',
  'drizzle-orm',
  'drizzle-orm/better-sqlite3',
  'pdf-parse',
  'mammoth',
  'tesseract.js',
  'electron-log',
  'electron-updater',
]

const preloadExternals = [...builtins]

const sharedBuild = {
  emptyOutDir: false,
  outDir: path.resolve(root, '.vite/build'),
  minify: false,
}

// Build main process
await build({
  root,
  mode: 'development',
  clearScreen: false,
  build: {
    ...sharedBuild,
    lib: {
      entry: path.resolve(root, 'src/main/index.ts'),
      fileName: () => '[name].js',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: mainExternals,
    },
  },
  define: {
    // Point main process to the Vite dev server Playwright starts
    MAIN_WINDOW_VITE_DEV_SERVER_URL: JSON.stringify('http://localhost:5173'),
    MAIN_WINDOW_VITE_NAME: JSON.stringify('main_window'),
  },
  resolve: {
    alias: {
      '@main': path.resolve(root, 'src/main'),
      '@shared': path.resolve(root, 'src/shared'),
    },
    conditions: ['node'],
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
})

// Build preload script
await build({
  root,
  mode: 'development',
  clearScreen: false,
  build: {
    ...sharedBuild,
    rollupOptions: {
      external: preloadExternals,
      input: path.resolve(root, 'src/preload/index.ts'),
      output: {
        format: 'cjs',
        inlineDynamicImports: true,
        entryFileNames: 'preload.js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(root, 'src/shared'),
    },
    conditions: ['node'],
  },
})

console.log('✔ Main and preload built for e2e testing.')
