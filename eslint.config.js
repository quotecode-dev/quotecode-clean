import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
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
])
