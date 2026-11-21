// SAST-only rule set (security + DOM XSS sinks), run as its own gate category.
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import security from 'eslint-plugin-security';
import nounsanitized from 'eslint-plugin-no-unsanitized';

export default defineConfig(
  { ignores: ['dist/**', 'coverage/**', '.astro/**', 'node_modules/**'] },
  { files: ['**/*.ts', '**/*.mjs', '**/*.js'], languageOptions: { parser: tseslint.parser } },
  security.configs.recommended,
  nounsanitized.configs.recommended,
  {
    rules: { 'security/detect-object-injection': 'off' },
  },
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.mjs'],
    rules: { 'security/detect-non-literal-fs-filename': 'off', 'security/detect-non-literal-regexp': 'off' },
  },
);
