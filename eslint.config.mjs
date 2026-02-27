import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import importX from 'eslint-plugin-import-x'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import prettierConfig from 'eslint-config-prettier/flat'

export default tseslint.config(
  // ── 1. Global ignores ────────────────────────────────────────────────
  {
    ignores: ['node_modules/', 'dist/', '.vite/', '**/.vite/', 'out/', '*.min.*'],
  },

  // ── 2. Base config: recommended rules for all TS/TSX files ───────────
  {
    files: ['**/*.{ts,tsx,mts}'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
  },

  // ── 3. Import plugin config with TypeScript resolver ─────────────────
  {
    files: ['**/*.{ts,tsx,mts}'],
    ...importX.flatConfigs.typescript,
    settings: {
      ...importX.flatConfigs.typescript.settings,
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          project: './tsconfig.json',
        }),
      ],
    },
  },

  // ── 4. Main process override ─────────────────────────────────────────
  {
    files: ['src/main/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // ── 5. Preload override ──────────────────────────────────────────────
  {
    files: ['src/preload/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // ── 6. Renderer override: browser globals + React + React Hooks ──────
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    ...reactPlugin.configs.flat.recommended,
    ...reactPlugin.configs.flat['jsx-runtime'],
    plugins: {
      ...reactPlugin.configs.flat.recommended.plugins,
      ...reactPlugin.configs.flat['jsx-runtime'].plugins,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      ...reactPlugin.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactPlugin.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.flat['recommended-latest'].rules,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  // ── 7. Shared override: no environment globals ───────────────────────
  {
    files: ['src/shared/**/*.ts'],
    languageOptions: {
      globals: {},
    },
  },

  // ── 8. Root config files override ────────────────────────────────────
  {
    files: ['*.config.ts', '*.config.mts', 'forge.config.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // ── 9. Prettier compat (must be last) ────────────────────────────────
  prettierConfig,
)
