import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import { createHash } from 'node:crypto'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import process from 'node:process'
import { sourceIdentity } from './scripts/build-identity.js'
import { prerenderPublicRoutesPlugin } from './scripts/prerender-public-routes.mjs'

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
//
// BROWSER-OBSERVABLE BUILD IDENTITY (TEKANGO_AI_ARCHITECTURE.md §51.17, 2026-09-22): a reviewer's browser tooling may run in an ISOLATED
// world (page JS globals such as window.__TEKANGO_BUILD__ are invisible there) and may block /version.json (ERR_BLOCKED_BY_CLIENT). So every
// non-production build ALSO embeds its identity in the DOM of index.html - <script type="application/json" id="tekango-build-identity">
// + <meta name="tekango-build-sha"> - which every world can read, and serves the same JSON at /tekango-build-identity.json. The identity
// carries an ASSET FINGERPRINT = sha256 over every emitted bundle file (name + sha256), computed after hashing, so a reader can prove the
// executing assets are exactly this build. Production builds are unchanged (no DOM identity).
const sha256hex = (b) => createHash('sha256').update(b).digest('hex');
const IDENTITY_PLACEHOLDER = '__TEKANGO_BUILD_IDENTITY_JSON__';
function browserIdentity(identity, outDir, fileNames, buildTime, testProjectRef) {
  // hashed from the FINAL bytes on disk (Vite rewrites the entry chunk after transformIndexHtml), every emitted file except index.html
  const assets = fileNames.filter((n) => n !== 'index.html').sort()
    .map((file) => ({ file, sha256: sha256hex(readFileSync(`${outDir}/${file}`)) }));
  return {
    schema: 'tekango-build-identity/1', buildSha: identity.buildSha, branch: identity.branch, dirty: identity.dirty, mode: identity.mode,
    buildInputDigest: identity.buildInputDigest, buildInputFileCount: identity.buildInputFileCount, testProjectRef, buildTime,
    assetsFingerprint: sha256hex(assets.map((a) => `${a.file}\0${a.sha256}\n`).join('')), assets,
  };
}
function versionManifestPlugin(identity, { exposeInDom, testProjectRef }) {
  const buildTime = new Date().toISOString();
  let domIdentity = null;
  return {
    name: 'proflow-version-manifest',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!exposeInDom || !ctx.bundle) return html; // build only; production never exposes it
        return html.replace('</head>', `    <meta name="tekango-build-sha" content="${identity.buildSha}" />\n    <script type="application/json" id="tekango-build-identity">${IDENTITY_PLACEHOLDER}</script>\n  </head>`);
      },
    },
    writeBundle(options, bundle) {
      const outDir = options.dir || 'dist';
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      if (exposeInDom && existsSync(`${outDir}/index.html`)) {
        domIdentity = browserIdentity(identity, outDir, Object.keys(bundle), buildTime, testProjectRef);
        const html = readFileSync(`${outDir}/index.html`, 'utf8');
        if (!html.includes(IDENTITY_PLACEHOLDER)) throw new Error('build identity placeholder missing from index.html');
        writeFileSync(`${outDir}/index.html`, html.replace(IDENTITY_PLACEHOLDER, () => JSON.stringify(domIdentity).replace(/</g, '\\u003c')));
        writeFileSync(`${outDir}/tekango-build-identity.json`, JSON.stringify({ ...domIdentity, servesWorkingTree: false }, null, 2));
      }
      writeFileSync(`${outDir}/version.json`, JSON.stringify({ ...identity, buildTime, servesWorkingTree: false, ...(domIdentity ? { assetsFingerprint: domIdentity.assetsFingerprint, testProjectRef } : {}) }, null, 2));
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
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const testProjectRef = (String(env.VITE_SUPABASE_URL || '').match(/^https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] || null;
  return {
  // prerenderPublicRoutesPlugin (2026-09-28): every client build ends by writing + validating the initial HTML of each public
  // sitemap route (scripts/prerender-public-routes.mjs); a missing or wrong route fails the build.
  plugins: [react(), versionManifestPlugin(identity, { exposeInDom: mode !== 'production', testProjectRef }), prerenderPublicRoutesPlugin()],
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
