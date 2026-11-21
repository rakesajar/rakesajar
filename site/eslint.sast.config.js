// SAST-only rule set (security + DOM XSS sinks), run as its own gate category.
// Covers .astro components too: their <script> blocks hold all client-side DOM code.
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import security from 'eslint-plugin-security';
import nounsanitized from 'eslint-plugin-no-unsanitized';

export default defineConfig(
  { ignores: ['dist/**', 'coverage/**', '.astro/**', 'node_modules/**'] },
  { files: ['**/*.ts', '**/*.mjs', '**/*.js'], languageOptions: { parser: tseslint.parser } },
  ...astro.configs['flat/base'],
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
