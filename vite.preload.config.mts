import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Override the default [name].js to avoid collision with the main
        // process build (both entries are named index.ts → index.js).
        // The main process expects the preload at path.join(__dirname, 'preload.js').
        entryFileNames: 'preload.js',
      },
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
})
