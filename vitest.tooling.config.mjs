// TOOLING test scope (Task 16 cloud, 2026-10-05): the preserved iron-law tooling tests that arrived with the sources
// supplement (docs/task16-quote-experience-v2/cloud-handoff/supplement/tooling). They are kept byte-identical to the
// supplement (manifest evidence) and run here, separately from the product scope (`npm test`), so their results stay
// visible. Known: 1 test in iron-laws.test.js fails because the supplement redacted a real-customer address that the
// test uses as its denylist probe (supplement/REDACTIONS.json) - a redaction artefact, not a product or tooling defect.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['docs/task16-quote-experience-v2/cloud-handoff/supplement/tooling/**/*.test.{js,mjs}'],
  },
});
