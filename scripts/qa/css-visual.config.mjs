// Baselines/output are local artifacts, never tracked synthetic account sessions.
const config = {
  testDir: '.',
  testMatch: 'css-visual.spec.mjs',
  timeout: 60000,
  expect: { timeout: 10000, toHaveScreenshot: { animations: 'disabled', maxDiffPixels: 0 } },
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: '../../test-results/css-run',
  snapshotPathTemplate: '{testDir}/../../.qa-artifacts/css-baselines/{arg}{ext}',
  use: {
    actionTimeout: 10000,
    channel: 'chrome', baseURL: 'http://127.0.0.1:3000',
    locale: 'en-US', timezoneId: 'America/New_York',
    reducedMotion: 'reduce', trace: 'off', video: 'off',
  },
};
export default config;
