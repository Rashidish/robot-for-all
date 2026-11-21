// ESLint flat config: TypeScript, Astro and Svelte.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.astro/**',
      '**/node_modules/**',
      'coverage/**',
      'apps/web/src/paraglide/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...astro.configs.recommended,
  ...svelte.configs.recommended,
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser }
    }
  },
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    }
  },
  {
    // Service worker template: __PRECACHE__ is filled in at build time.
    files: ['apps/web/src/sw/sw-template.js'],
    languageOptions: {
      globals: { ...globals.serviceworker, __PRECACHE__: 'readonly' }
    }
  }
);
