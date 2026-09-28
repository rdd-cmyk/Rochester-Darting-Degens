const config = {
  testDir: '.', testMatch: 'invites.spec.mjs', timeout: 90000, expect: { timeout: 15000 },
  workers: 1, retries: 0, reporter: 'list', outputDir: '../../test-results/invites',
  use: { channel: 'chrome', baseURL: 'http://127.0.0.1:3102', viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure' },
};
export default config;
