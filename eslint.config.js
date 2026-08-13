import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'supabase/**',
      'EMAIL-TEMPLATES-EXEMPLOS.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'vite.config.ts'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Data-loading effects intentionally transition local loading/error state.
      // The rule targets React Compiler optimizations, not runtime correctness.
      'react-hooks/set-state-in-effect': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['*.config.cjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
)
