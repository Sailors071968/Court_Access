// ============================================================================
// CourtAccess backend ESLint (flat config).
// Node/TypeScript service package. Type-safety is enforced by `tsc` (strict,
// noImplicitAny, noUnusedLocals/Parameters — see tsconfig.json); ESLint layers
// on style/correctness rules.
//
// `no-explicit-any` is intentionally disabled: the backend deliberately uses
// `any` for dynamic legal-document / JSON payload shapes at trust boundaries.
// Implicit `any` is already prohibited by tsc's noImplicitAny (which passes),
// so no *unintentional* any can slip in.
// ============================================================================

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const unusedVarsRule = [
  'error',
  {
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    caughtErrorsIgnorePattern: '^_',
    destructuredArrayIgnorePattern: '^_',
    ignoreRestSiblings: true,
  },
];

export default tseslint.config(
  {
    ignores: [
      'dist',
      '**/dist/**',
      '**/node_modules/**',
      'prisma/generated/**',
      'node_modules/.prisma/**',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/**/*.ts', 'scripts/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': unusedVarsRule,
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
