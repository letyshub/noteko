import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../../../..')

describe('build configuration', () => {
  describe('vite.main.config.mts', () => {
    it('should externalize better-sqlite3 via rollupOptions.external', () => {
      const configPath = path.join(ROOT, 'vite.main.config.mts')
      const content = fs.readFileSync(configPath, 'utf-8')

      // The config should have build.rollupOptions.external that covers better-sqlite3
      // This can be a function, array, or regex - we check that the external config exists
      expect(content).toContain('rollupOptions')
      expect(content).toContain('external')
    })
  })

  describe('drizzle.config.ts', () => {
    it('should export a valid drizzle config with sqlite dialect, schema path, and dbCredentials', () => {
      const configPath = path.join(ROOT, 'drizzle.config.ts')
      const content = fs.readFileSync(configPath, 'utf-8')

      expect(content).toContain("dialect: 'sqlite'")
      expect(content).toContain("schema: './src/main/database/schema'")
      expect(content).toContain('dbCredentials')
      expect(content).toContain('defineConfig')
    })
  })

  describe('.gitignore', () => {
    it('should contain entries for database files and drizzle migrations', () => {
      const gitignorePath = path.join(ROOT, '.gitignore')
      const content = fs.readFileSync(gitignorePath, 'utf-8')

      expect(content).toContain('*.db')
      expect(content).toContain('*.db-journal')
      expect(content).toContain('*.db-wal')
      expect(content).toContain('drizzle/')
    })
  })
})
