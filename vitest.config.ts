import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/**/src/**/*.test.ts', 'packages/**/src/**/*.test.ts', 'scripts/**/*.test.ts'],
    passWithNoTests: true,
    // Vitest blanks CSS files by default; the colour-contrast test needs the real tokens.
    css: { include: [/tokens\.css/] }
  }
});
