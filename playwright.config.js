// Critical-journey automation against the canonical TEST mirror
// (Systemic Closure task, Item B). Requires `npm run dev:localtest`
// already running on port 5186 - this config does not start it, to avoid
// racing the persona/tier setup scripts that must run against the same
// long-lived TEST mirror server.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Was 60000. Fresh isolated-run evidence (Final Narrow Validation Closure
  // task, 2026-09-09) measured real WebKit/mobile page loads on this
  // machine up to ~45s even against a freshly-restarted, otherwise-idle dev
  // server - 60s left too little margin for the rest of a test's steps
  // after a slow load. This is a timeout-ceiling correction to match
  // observed reality, not a mechanism to hide failures: no retries were
  // added and no assertion was loosened.
  timeout: 90000,
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
    // Tablet is a first-class responsive category, never folded into
    // Mobile (Final Narrow Validation Closure task, 2026-09-09) - both
    // orientations of a real device profile (iPad Mini: 768x1024 portrait).
    { name: 'tablet-portrait', use: { ...devices['iPad Mini'] } },
    { name: 'tablet-landscape', use: { ...devices['iPad Mini landscape'] } },
  ],
});
