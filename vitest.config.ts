import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@main': path.resolve(__dirname, 'src/main'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/__tests__/**', '**/*.test.{ts,tsx}', '**/node_modules/**'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'shared',
          environment: 'node',
          globals: true,
          include: ['src/shared/**/__tests__/**/*.test.{ts,tsx}'],
          exclude: ['node_modules', 'dist', '.vite', 'e2e'],
        },
      },
      {
        extends: true,
        test: {
          name: 'main',
          environment: 'node',
          globals: true,
          include: ['src/main/**/__tests__/**/*.test.{ts,tsx}'],
          exclude: ['node_modules', 'dist', '.vite', 'e2e'],
        },
      },
      {
        extends: true,
        test: {
          name: 'renderer',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./tests/setup.ts'],
          include: ['tests/**/*.test.{ts,tsx}', 'src/renderer/**/__tests__/**/*.test.{ts,tsx}'],
          exclude: ['node_modules', 'dist', '.vite', 'e2e'],
        },
      },
    ],
  },
})
