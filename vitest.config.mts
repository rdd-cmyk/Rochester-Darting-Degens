import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

const repositoryRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(repositoryRoot),
    },
  },
  test: {
    // Transform both SDKs so their Next navigation imports use the same test
    // router mock (Speed Insights also publishes a CommonJS entry point).
    server: { deps: { inline: ['@vercel/analytics', '@vercel/speed-insights'] } },
    exclude: [...configDefaults.exclude, 'scripts/qa/**'],
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['lib/stats/**/*.ts', 'lib/matchState.js'],
      reporter: ['text', 'html'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
});
