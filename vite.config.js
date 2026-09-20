import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { existsSync } from 'node:fs'

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

function versionManifestPlugin() {
  const buildSha = getBuildSha();
  const buildTime = new Date().toISOString();
  const manifest = JSON.stringify({ buildSha, buildTime }, null, 2);
  return {
    name: 'proflow-version-manifest',
    // TEKANGO RTL Remediation Closure task (2026-09-16), Test Source
    // Identity: this plugin previously only ran `apply: 'build'`, so
    // `/version.json` never existed under `vite dev` - the canonical Owner
    // TEST (5186) runs as a dev server, not a built/served static site, so
    // that endpoint was simply unreachable there. Extending the SAME
    // existing mechanism (same two fields, same getBuildSha() source of
    // truth) to also serve during dev via `configureServer`, rather than
    // inventing a second, competing identity framework. `buildSha` reflects
    // the committed HEAD only (identical across sibling worktrees branched
    // from the same base commit with different *uncommitted* diffs, e.g.
    // C:\tkrtl1 vs C:\tkpost1) - `buildTime` (this dev server's own start
    // timestamp) is what actually distinguishes "which process/start is
    // currently answering on this port" for verification purposes; it does
    // NOT by itself prove an exact uncommitted-file identity, which would
    // require genuinely new, out-of-scope, working-tree-hashing
    // architecture - disclosed here rather than overclaimed.
    writeBundle(options) {
      const outDir = options.dir || 'dist';
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      writeFileSync(`${outDir}/version.json`, manifest);
    },
    configureServer(server) {
      server.middlewares.use('/version.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(manifest);
      });
    },
  };
}

// https://vite.dev/config/
// Deployment trigger: forces a fresh Vercel build to pick up vercel.json rewrites/crons.
export default defineConfig({
  plugins: [react(), versionManifestPlugin()],
  define: {
    __PROFLOW_BUILD_SHA__: JSON.stringify(getBuildSha()),
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
})
