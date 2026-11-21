// Lint + SAST rules for TypeScript and scripts. .astro templates are type-checked by `astro check`.
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import security from 'eslint-plugin-security';
import nounsanitized from 'eslint-plugin-no-unsanitized';

export default defineConfig(
  { ignores: ['dist/**', 'coverage/**', '.astro/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  security.configs.recommended,
  nounsanitized.configs.recommended,
  {
    rules: {
      // Object keys here come from typed, static data (fact ids, currency codes), not user input.
      'security/detect-object-injection': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly', fetch: 'readonly', setTimeout: 'readonly', window: 'readonly', document: 'readonly' } },
    rules: {
      // Paths are derived from the build output directory, not user input.
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-non-literal-regexp': 'off',
    },
  },
);
