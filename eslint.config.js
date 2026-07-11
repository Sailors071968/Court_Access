import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

// Align eslint's unused-vars handling with the TypeScript convention used
// across the codebase: identifiers intentionally prefixed with `_` are treated
// as deliberately unused (matches tsconfig noUnusedLocals/noUnusedParameters).
const unusedVarsRule = [
  'error',
  {
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    caughtErrorsIgnorePattern: '^_',
    destructuredArrayIgnorePattern: '^_',
  },
]

export default tseslint.config(
  // `backend/` is a separate npm package with its own toolchain and is linted
  // by its own configuration, not by this frontend package's config.
  {
    ignores: [
      'dist',
      '**/dist/**',
      '**/node_modules/**',
      'backend/**',
      'public/**',
    ],
  },
  // Frontend application code (browser runtime + React).
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': unusedVarsRule,
    },
  },
  // Workers, deployment/verification scripts, and package-level tests
  // (Node runtime, no React).
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: [
      'workers/**/*.ts',
      'scripts/**/*.{ts,mjs,js}',
      'tests/**/*.ts',
      '*.{ts,mjs,js}',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': unusedVarsRule,
    },
  },
)
