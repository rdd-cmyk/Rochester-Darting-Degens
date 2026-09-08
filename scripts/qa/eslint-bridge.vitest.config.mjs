import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Opt-in diagnostic suite; never replaces the normal app tests or lint config.
export default defineConfig({
  root: fileURLToPath(new URL('../../', import.meta.url)),
  test: {
    environment: 'node',
    include: ['scripts/qa/eslint-bridge.test.mjs'],
    testTimeout: 20000,
  },
});
