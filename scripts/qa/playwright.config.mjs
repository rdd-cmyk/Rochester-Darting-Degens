const config = {
  testDir: '.',
  testMatch: 'local-acceptance.spec.mjs',
  timeout: 90000,
  expect: { timeout: 10000 },
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: '../../test-results',
  use: { channel: 'chrome', actionTimeout: 15000, baseURL: 'http://127.0.0.1:3000', viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure' },
};
export default config;
