import { defineConfig } from 'vite'
import path from 'node:path'
import { builtinModules } from 'node:module'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: (id) => {
        // Externalize Node.js builtins and all node_modules packages
        // This prevents Vite from bundling native modules like better-sqlite3
        if (builtinModules.includes(id) || id.startsWith('node:')) return true
        if (!id.startsWith('.') && !path.isAbsolute(id)) return true
        return false
      },
    },
  },
  resolve: {
    alias: {
      '@main': path.resolve(__dirname, 'src/main'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
})
