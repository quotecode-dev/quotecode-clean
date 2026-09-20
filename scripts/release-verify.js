// ONE aggregate, fail-closed release verification gate (pre-LIVE closure).
//
// Usage: node scripts/release-verify.js [--profile test|rc] [--test-ref <ref>] [--prod-ref <ref>] [--out release-evidence/verify-result.json]
//
// Every step must PASS; any step that fails, throws, or cannot produce
// evidence fails the whole gate (exit 1). There is no warning-only blocker.
//
// Profiles:
//   test  active TEST tree (dirty allowed). Records the working-tree digest
//         and reports RC_FREEZE_ELIGIBLE=false while the tree is dirty.
//   rc    exact frozen snapshot. Requires a CLEAN tree and a manifest that
//         binds the Owner acceptance to this SHA + digest.
//
// Read-only: it never deploys, migrates, or mutates any Supabase project.
// Secret VALUES are never read into the result - names only.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { cwd } from 'node:process';
import { pathToFileURL } from 'node:url';

const ROOT = cwd();
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i === -1 ? fallback : args[i + 1]; };
const PROFILE = opt('--profile', 'test');
const TEST_REF = opt('--test-ref', 'ljfizgrdyzxddswcedwr');
const PROD_REF = opt('--prod-ref', 'ixabnzhjeqevtbhdfswv');
const OUT = opt('--out', join('release-evidence', 'verify-result.json'));
const EVIDENCE_DIR = 'release-evidence';

const sh = (cmd, cmdArgs, extra = {}) => spawnSync(cmd, cmdArgs, { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024, ...extra });
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// Locked-contract guard tests that must exist (a deleted guard is a failure).
export const REQUIRED_GUARD_TESTS = [
  'src/components/AdminUnifiedShell.test.js',
  'src/components/AdminCopyParity.test.js',
  'src/components/AdminPresentation.test.jsx',
  'src/components/AuthenticatedShellFrames.test.jsx',
  'src/components/PublicQuoteHeader.test.jsx',
  'src/pages/Dashboard.hotquote.test.js',
  'src/pages/Dashboard.navigation.test.js',
  'src/pages/landingFirstLiveTruth.test.js',
  'src/utils/headerDateFormat.test.js',
  'scripts/check-structured-quote-rc-migration-allowlist.test.js',
  'scripts/check-component-divergence.test.js',
];

// Build-relevant inputs whose digest identifies the application state.
const BUILD_INPUT_ROOTS = ['src', 'public', 'supabase/migrations', 'supabase/functions', 'index.html', 'package.json', 'package-lock.json', 'vite.config.js', '.gitattributes'];

export function listBuildInputs() {
  const out = git('ls-files', '-co', '--exclude-standard', '-z', '--', ...BUILD_INPUT_ROOTS);
  // Test/spec files are not build inputs: editing a test must not invalidate UI acceptance evidence.
  return out.split('\0').filter(Boolean).filter((f) => !/\.(test|spec)\.[cm]?[jt]sx?$/.test(f)).filter((f) => existsSync(join(ROOT, f))).sort();
}

export function computeTreeDigest(files) {
  const h = createHash('sha256');
  for (const f of files) {
    // LF-normalised so a Windows autocrlf checkout cannot change the digest.
    const bytes = readFileSync(join(ROOT, f));
    const text = bytes.toString('latin1').includes('\0') ? bytes : Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
    h.update(f).update('\0').update(sha256(text)).update('\n');
  }
  return h.digest('hex');
}

function digestDir(dir) {
  const files = [];
  const walk = (d) => readdirSync(d).forEach((n) => { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : files.push(p); });
  walk(dir);
  const h = createHash('sha256');
  files.sort().forEach((f) => h.update(relative(dir, f).replace(/\\/g, '/')).update('\0').update(sha256(readFileSync(f))).update('\n'));
  return h.digest('hex');
}

function functionsList(ref) {
  const r = sh('npx', ['supabase', 'functions', 'list', '--project-ref', ref]);
  if (r.status !== 0) throw new Error(`supabase functions list failed for ${ref}`);
  const data = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
  return (data.functions || []).map((f) => ({ name: f.slug, version: f.version, sourceHash: f.ezbr_sha256 || null }));
}

function secretNames(ref) {
  const r = sh('npx', ['supabase', 'secrets', 'list', '--project-ref', ref, '-o', 'json']);
  if (r.status !== 0) throw new Error(`supabase secrets list failed for ${ref}`);
  // Names only - the parsed values are dropped immediately.
  return JSON.parse(r.stdout.slice(r.stdout.indexOf('['))).map((s) => s.name).sort();
}

function requiredSecretNames(functionNames) {
  const names = new Set();
  for (const fn of functionNames) {
    const file = join(ROOT, 'supabase', 'functions', fn, 'index.ts');
    if (!existsSync(file)) continue;
    for (const m of readFileSync(file, 'utf8').matchAll(/Deno\.env\.get\(['"]([A-Z0-9_]+)['"]/g)) names.add(m[1]);
  }
  // Platform-injected, not user-managed secrets.
  return [...names].filter((n) => !/^SUPABASE_/.test(n)).sort();
}

const state = { distDir: null, artifactDigest: null, treeDigest: null, files: [], manifest: null };
const results = [];
const step = (name, fn) => {
  const started = Date.now();
  try {
    const detail = fn();
    results.push({ name, status: 'PASS', detail: detail ?? '', ms: Date.now() - started });
  } catch (error) {
    results.push({ name, status: 'FAIL', detail: String(error.message || error).slice(0, 600), ms: Date.now() - started });
  }
};
const must = (cond, msg) => { if (!cond) throw new Error(msg); };
const run = (label, cmd, cmdArgs) => {
  const r = sh(cmd, cmdArgs);
  must(r.status === 0, `${label} exited ${r.status}: ${(r.stdout + r.stderr).split('\n').filter(Boolean).slice(-6).join(' | ')}`);
  return r.stdout;
};

export function verify() {
  step('guard tests present', () => {
    const missing = REQUIRED_GUARD_TESTS.filter((f) => !existsSync(join(ROOT, f)));
    must(missing.length === 0, `missing locked-contract guard tests: ${missing.join(', ')}`);
    return `${REQUIRED_GUARD_TESTS.length} guard test files`;
  });

  step('full unit suite (vitest)', () => {
    const out = run('vitest', 'npx', ['vitest', 'run']);
    return (out.match(/Tests\s+[^\n]+/) || [''])[0].trim();
  });

  step('lint (eslint, zero errors)', () => {
    const r = sh('npx', ['eslint', '.']);
    must(r.status === 0, `eslint reported errors: ${r.stdout.split('\n').filter((l) => / error /.test(l)).slice(0, 5).join(' | ')}`);
    return (r.stdout.match(/\(\d+ errors?, \d+ warnings?\)/) || ['clean'])[0];
  });

  step('production build', () => {
    // Built inside the workspace (gitignored) so sibling checks can take a relative path.
    state.distDir = 'dist-release-verify';
    rmSync(join(ROOT, state.distDir), { recursive: true, force: true });
    run('vite build', 'npx', ['vite', 'build', '--outDir', state.distDir, '--emptyOutDir']);
    state.artifactDigest = digestDir(join(ROOT, state.distDir));
    return `artifact digest ${state.artifactDigest.slice(0, 16)}`;
  });

  step('SPA fallback safety (built artifact)', () => { run('spa fallback', 'node', ['scripts/check-spa-fallback-safety.js', state.distDir]); });
  step('asset completeness', () => { run('assets', 'node', ['scripts/check-asset-completeness.js']); });
  step('build-source scope', () => { run('build-source scope', 'node', ['scripts/check-build-source-scope.js']); });
  step('external-source escape', () => { run('external escape', 'node', ['scripts/check-external-source-escape.js']); });

  step('component divergence vs canonical TEST source (Header/Sidebar/Admin/scroll/Public Quote/AI Chat/pricing/landing)', () => {
    const r = sh('node', ['scripts/check-component-divergence.js']);
    must(r.status === 0, 'component-divergence gate failed');
    must(!/\[ERROR\]/.test(r.stdout), 'divergence from the CANONICAL TEST source found');
    return (r.stdout.match(/Component-divergence gate: [^\n]+/) || [''])[0];
  });

  step('working-tree / build-input identity', () => {
    state.files = listBuildInputs();
    state.treeDigest = computeTreeDigest(state.files);
    const dirty = git('status', '--porcelain', '--', ...BUILD_INPUT_ROOTS).split('\n').filter(Boolean);
    if (PROFILE === 'rc') must(dirty.length === 0, `RC profile requires a clean tree; ${dirty.length} dirty build-input paths`);
    return `${state.files.length} build inputs, digest ${state.treeDigest.slice(0, 16)}, dirty=${dirty.length}`;
  });

  step('DB migration ledger (pinned Production-forward bytes)', () => {
    const dir = join(ROOT, 'supabase', 'migrations');
    const ledger = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => ({ file: f, sha256: sha256(Buffer.from(readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n'))) }));
    must(ledger.length > 0, 'no migrations found');
    state.migrationLedger = ledger;
    // Pinned hashes themselves are enforced by the allowlist test in the unit suite.
    // Identity + classification of EVERY local migration (unclassified = fail).
    run('migration allowlist', 'node', ['scripts/check-structured-quote-rc-migration-allowlist.js']);
    return `${ledger.length} migrations ledgered; identity + classification PASS`;
  });

  step('Edge function ledger (TEST project versions + source hashes)', () => {
    const fns = functionsList(TEST_REF);
    must(fns.length > 0, 'no functions returned');
    state.edgeLedger = fns;
    const required = ['chat-ai', 'get-public-quote', 'send-quote-email'];
    const missing = required.filter((n) => !fns.some((f) => f.name === n));
    must(missing.length === 0, `required first-LIVE functions missing in TEST: ${missing.join(', ')}`);
    return `${fns.length} functions`;
  });

  step('required secret NAME parity (names only)', () => {
    // First-LIVE functions only. auth-send-email-hook is a TEST-only lineage (Production Auth email stays on the built-in mailer).
    const required = requiredSecretNames(['chat-ai', 'get-public-quote', 'send-quote-email', 'send-welcome-email']);
    const test = secretNames(TEST_REF);
    const prod = secretNames(PROD_REF);
    const missingTest = required.filter((n) => !test.includes(n));
    const missingProd = required.filter((n) => !prod.includes(n));
    state.secretNames = { required, testPresent: test.filter((n) => required.includes(n)), prodPresent: prod.filter((n) => required.includes(n)) };
    must(missingTest.length === 0, `required secret names missing in TEST: ${missingTest.join(', ')}`);
    must(missingProd.length === 0, `required secret names missing in Production: ${missingProd.join(', ')}`);
    return `${required.length} required names present in both`;
  });

  step('responsive acceptance evidence present and all cells PASS', () => {
    const file = join(ROOT, EVIDENCE_DIR, 'first-live-responsive-matrix.json');
    must(existsSync(file), `${EVIDENCE_DIR}/first-live-responsive-matrix.json missing`);
    const matrix = JSON.parse(readFileSync(file, 'utf8'));
    must(Array.isArray(matrix.cells) && matrix.cells.length > 0, 'matrix has no cells');
    const bad = matrix.cells.filter((c) => c.status !== 'PASS');
    must(bad.length === 0, `${bad.length} matrix cells not PASS: ${bad.slice(0, 4).map((c) => `${c.lang}/${c.surface}/${c.viewport}`).join(', ')}`);
    // Evidence must have been captured on exactly this application state.
    must(matrix.treeDigest === state.treeDigest, `acceptance evidence is stale: captured on ${String(matrix.treeDigest).slice(0, 12)}, current tree is ${String(state.treeDigest).slice(0, 12)} - re-run the matrix scripts`);
    return `${matrix.cells.length} cells, evidence bound to current tree ${state.treeDigest.slice(0, 12)}`;
  });

  step('release manifest complete', () => {
    const manifest = buildManifest();
    state.manifest = manifest;
    const missing = MANIFEST_REQUIRED_KEYS.filter((k) => manifest[k] === undefined || manifest[k] === null || manifest[k] === '');
    must(missing.length === 0, `manifest missing: ${missing.join(', ')}`);
    mkdirSync(join(ROOT, EVIDENCE_DIR), { recursive: true });
    writeFileSync(join(ROOT, EVIDENCE_DIR, 'release-manifest.json'), JSON.stringify(manifest, null, 2));
    if (PROFILE === 'rc') must(manifest.ownerAcceptance && manifest.ownerAcceptance.status === 'ACCEPTED' && manifest.ownerAcceptance.boundSha === manifest.commitSha && manifest.ownerAcceptance.boundTreeDigest === manifest.applicationTreeDigest, 'RC requires Owner acceptance bound to this SHA + digest');
    return `${Object.keys(manifest).length} fields`;
  });

  if (state.distDir) rmSync(join(ROOT, state.distDir), { recursive: true, force: true });
  const failed = results.filter((r) => r.status !== 'PASS');
  return { profile: PROFILE, passed: failed.length === 0, rcFreezeEligible: PROFILE === 'rc' ? failed.length === 0 : false, results };
}

export const MANIFEST_REQUIRED_KEYS = [
  'canonicalTestSource', 'ownerTestUrl', 'releaseProfileId', 'commitSha', 'branch', 'applicationTreeDigest', 'finalArtifactDigest',
  'includedLineages', 'deferredLineages', 'lockedContracts', 'shellIdentity', 'dbMigrationLedger', 'edgeFunctions', 'requiredSecretNames',
  'evidenceRefs', 'ownerAcceptance', 'priorLiveBaseline',
];

function buildManifest() {
  const acceptFile = join(ROOT, EVIDENCE_DIR, 'owner-acceptance.json');
  const ownerAcceptance = existsSync(acceptFile) ? JSON.parse(readFileSync(acceptFile, 'utf8')) : { status: 'PENDING' };
  return {
    schema: 'tekango-release-manifest/2',
    canonicalTestSource: ROOT,
    ownerTestUrl: 'http://192.168.1.189:5186/',
    releaseProfileId: 'first-live-2026-09',
    commitSha: git('rev-parse', 'HEAD'),
    branch: git('branch', '--show-current'),
    workingTreeDirty: git('status', '--porcelain', '--', ...BUILD_INPUT_ROOTS).split('\n').filter(Boolean).length > 0,
    applicationTreeDigest: state.treeDigest,
    finalArtifactDigest: state.artifactDigest,
    includedLineages: ['Unified Admin (read-only operational profile)', 'Canonical authenticated Header + fixed-height alert slot', 'Context-driven AI Chat V3 (deployed chat-ai)', 'Structured/Professional Quote', 'Public Quote locked geometry', 'Landing HE/EN truth sync', 'Read-only informational plans'],
    deferredLineages: ['Admin sensitive actions (Lifetime grant/revoke, trial extension, protected delete, quote reset) - backend deployment deferred', 'Deterministic direct-facts chat-ai TEST version', 'Paid checkout / subscription cancellation', 'AI Email (all stages)', 'Auth Send Email Hook (TEST-only; Production Auth email stays on the built-in mailer)'],
    lockedContracts: ['Header', 'Greeting/clock', 'Mobile Header row', 'AI Chat placement', 'Sidebar geometry', 'Authenticated scrolling', 'Public Quote'],
    shellIdentity: { header: 'dash-upper-section (AuthenticatedShell)', sidebar: 'AuthenticatedSidebarFrame', adminFrame: 'AdminScreenFrame on pf-screen primitives', publicQuote: 'PublicQuoteHeader', aiChat: 'AIChatWidget (Header launcher only)' },
    dbMigrationLedger: state.migrationLedger,
    edgeFunctions: state.edgeLedger,
    requiredSecretNames: state.secretNames,
    evidenceRefs: [`${EVIDENCE_DIR}/first-live-responsive-matrix.json`, `${EVIDENCE_DIR}/verify-result.json`],
    ownerAcceptance,
    priorLiveBaseline: 'origin/main (see PROFLOW_CODEX_CHECKPOINT.md: bb617b8 / 6fe41bc LIVE releases)',
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = verify();
  mkdirSync(join(ROOT, EVIDENCE_DIR), { recursive: true });
  writeFileSync(join(ROOT, OUT), JSON.stringify({ ...result, treeDigest: state.treeDigest, artifactDigest: state.artifactDigest, at: new Date().toISOString() }, null, 2));
  for (const r of result.results) console.log(`${r.status === 'PASS' ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  -  ${r.detail}` : ''}`);
  console.log(`\nRELEASE VERIFY GATE (${PROFILE}): ${result.passed ? 'PASS' : 'FAIL'}${result.passed ? '' : ' (fail-closed)'}`);
  process.exit(result.passed ? 0 : 1);
}
