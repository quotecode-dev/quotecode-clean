import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Product lint scope. Preserved copies are NOT product code and must stay byte-identical (their manifests are evidence):
  // the approved design reference package and the sources supplement (canonical docs, tooling and evidence copies from the
  // Owner's local checkouts). They are linted separately and visibly by `npm run lint:preserved` (expected to report their
  // own known findings) - never hidden from the report.
  globalIgnores(['dist', 'docs/task16-quote-experience-v2/cloud-handoff/reference/**', 'docs/task16-quote-experience-v2/cloud-handoff/supplement/**']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // Only the classic, battle-tested hooks rules - the rest of the "recommended"
      // preset in eslint-plugin-react-hooks v7+ targets React Compiler adoption
      // (purity/immutability/set-state-in-effect/etc.) and isn't what this project needs.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Vercel serverless functions run under Node, not the browser
    files: ['api/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // TEKANGO live-release guards run under Node via `npm run check:*`,
    // not the browser.
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
