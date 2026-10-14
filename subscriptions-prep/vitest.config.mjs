// Subscriptions PREPARATION scope (2026-10-07 night task) - PREPARATION / NOT ACTIVATED.
// This folder is deliberately outside BUILD_INPUT_ROOTS (scripts/build-identity.js) and outside the product vitest scope:
// its tests use the `*.prep-test.{js,mjs,ts}` suffix, which the default product include pattern never matches, so
// `npm test` and the locked build-input digest are unaffected. Run explicitly:
//   npx vitest run --config subscriptions-prep/vitest.config.mjs
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    root: new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
    include: ['subscriptions-prep/**/*.prep-test.{js,mjs,ts}'],
  },
});
