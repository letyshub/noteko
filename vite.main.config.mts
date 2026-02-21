import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Packages to externalize from the main-process bundle.
// The forge plugin already externalizes Node.js builtins and 'electron/*',
// but we must also externalize native modules and packages used via dynamic import().
const externalPackages = [
  'better-sqlite3',
  'drizzle-orm',
  'drizzle-orm/better-sqlite3',
  'pdf-parse',
  'mammoth',
  'tesseract.js',
  'electron-log',
]

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: externalPackages,
    },
  },
  resolve: {
    alias: {
      '@main': path.resolve(__dirname, 'src/main'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
})
