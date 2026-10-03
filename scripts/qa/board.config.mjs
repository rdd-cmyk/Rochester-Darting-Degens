const config = {
  testDir: '.', testMatch: 'board.spec.mjs', timeout: 90000, expect: { timeout: 12000 },
  workers: 1, retries: 0, reporter: 'list', outputDir: '../../test-results/board',
  use: { channel: 'chrome', actionTimeout: 15000, baseURL: 'http://127.0.0.1:3100', viewport: { width: 1366, height: 1000 }, screenshot: 'only-on-failure' },
};
export default config;
