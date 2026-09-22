import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { existsSync } from 'node:fs'
import process from 'node:process'
import { sourceIdentity } from './scripts/build-identity.js'

// Frontend Version Awareness (Gate F, systemic remediation continuation
// task, 2026-09-09): every build embeds its own git commit SHA both into
// the JS bundle (import.meta.env.VITE_BUILD_SHA, baked in at build time -
// what an ALREADY-OPEN tab is running) and into public/version.json
// (served statically, always reflecting the CURRENTLY DEPLOYED build,
// since static /public files are never cached by an in-memory tab the way
// the JS bundle itself is). src/shared/versionAwareness.js polls the
// latter and compares - see that file for the polling/UI logic.
function getBuildSha() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

// 5186 SERVED + LOADED IDENTITY (IRON-OWNERTEST-001 hardening, Codex review 2026-09-22): the former dev manifest was computed ONCE
// at server start (a stale dirty flag / SHA while the working tree kept changing) and carried no source digest, so it could not prove
// what a browser tab actually loaded. Now:
//   - build: dist/version.json carries the full source identity (SHA, branch, worktree, build-input dirtiness, mode, NORMALIZED
//     build-input digest identical to the release tooling) and the same identity is baked into the bundle (__PROFLOW_BUILD_IDENTITY__
//     -> window.__TEKANGO_BUILD__), so the LOADED tab can be compared with the SERVED files and the candidate's git objects;
//   - dev: /version.json is recomputed on EVERY request from the working tree (never a start-time snapshot) and says servesWorkingTree.
function versionManifestPlugin(identity) {
  const buildTime = new Date().toISOString();
  return {
    name: 'proflow-version-manifest',
    writeBundle(options) {
      const outDir = options.dir || 'dist';
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      writeFileSync(`${outDir}/version.json`, JSON.stringify({ ...identity, buildTime, servesWorkingTree: false }, null, 2));
    },
    configureServer(server) {
      server.middlewares.use('/version.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ ...sourceIdentity(process.cwd(), server.config.mode), buildTime, bundleBuildSha: identity.buildSha, servesWorkingTree: true }, null, 2));
      });
    },
  };
}

// https://vite.dev/config/
// Deployment trigger: forces a fresh Vercel build to pick up vercel.json rewrites/crons.
export default defineConfig(({ mode }) => {
  const identity = sourceIdentity(process.cwd(), mode);
  return {
  plugins: [react(), versionManifestPlugin(identity)],
  define: {
    __PROFLOW_BUILD_SHA__: JSON.stringify(getBuildSha()),
    __PROFLOW_BUILD_IDENTITY__: JSON.stringify({ buildSha: identity.buildSha, buildInputDigest: identity.buildInputDigest, dirty: identity.dirty, mode }),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    // e2e/ holds Playwright specs (a separate test runner, `npx playwright
    // test`) - they import from '@playwright/test', not vitest, and must
    // never be picked up by vitest's own default file globbing.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
  };
})
