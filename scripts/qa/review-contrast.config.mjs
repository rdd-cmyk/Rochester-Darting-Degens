import config from './playwright.config.mjs';

const reviewConfig = {
  ...config,
  testMatch: 'review-contrast.spec.mjs',
  outputDir: '../../test-results/review-contrast',
  // Dedicated preview avoids interrupting the feature-worktree preview on 3000.
  use: { ...config.use, baseURL: 'http://127.0.0.1:3001', reducedMotion: 'reduce' },
};

export default reviewConfig;
