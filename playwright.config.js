// Critical-journey automation against the canonical TEST mirror
// (Systemic Closure task, Item B). Requires `npm run dev:localtest`
// already running on port 5186 - this config does not start it, to avoid
// racing the persona/tier setup scripts that must run against the same
// long-lived TEST mirror server.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5186',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
});
