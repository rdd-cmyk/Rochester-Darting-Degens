const config = {
  testDir: ".",
  testMatch: "league-night.spec.mjs",
  timeout: 120000,
  expect: { timeout: 15000 },
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: "../../test-results/league-night",
  use: {
    channel: "msedge",
    baseURL: "http://127.0.0.1:3010",
    viewport: { width: 1440, height: 1100 },
    screenshot: "only-on-failure",
  },
};
export default config;
