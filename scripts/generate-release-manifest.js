// Release manifest generator (Gate G).
//
// Owner-authorized systemic remediation task (2026-09-09): no release in
// this project's history has ever produced a single, durable record of
// exactly what a release actually contained - frontend commit, migration
// set, Edge Function versions, required config - separate from prose in a
// continuity document. This script generates that record as one JSON file
// per release, meant to be committed alongside (or referenced by) the
// continuity docs, and consumed by scripts/check-test-live-parity.js's
// eventual Gate E (Production smoke on the deployed artifact).
//
// It is read-only against git and the Supabase CLI - it never deploys,
// migrates, or mutates anything.
//
// Usage: node scripts/generate-release-manifest.js [--out <path>] [--prod-ref <ref>] [--test-gate-result <path-to-json>]
import { execFileSync } from 'node:child_process';
import { writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_PROD_REF = 'ixabnzhjeqevtbhdfswv';

function git(cmd) {
  return execFileSync('git', cmd.split(' '), { encoding: 'utf-8', cwd: process.cwd() }).trim();
}

function getFunctionList(ref) {
  const out = execFileSync('npx', ['supabase', 'functions', 'list', '--project-ref', ref], { encoding: 'utf-8', shell: true });
  const data = JSON.parse(out.slice(out.indexOf('{')));
  return (data.functions || []).map((f) => ({
    name: f.slug,
    version: f.version,
    updatedAt: new Date(f.updated_at).toISOString(),
    sourceHash: f.ezbr_sha256 || null,
  }));
}

function localMigrationSet() {
  const dir = join(process.cwd(), 'supabase', 'migrations');
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  } catch {
    return [];
  }
}

function localRequiredConfigNames() {
  const names = new Set();
  const fnDir = join(process.cwd(), 'supabase', 'functions');
  try {
    for (const fn of readdirSync(fnDir, { withFileTypes: true })) {
      if (!fn.isDirectory()) continue;
      const indexPath = join(fnDir, fn.name, 'index.ts');
      try {
        const src = readFileSync(indexPath, 'utf-8').replace(/\/\/.*$/gm, '');
        for (const m of src.matchAll(/Deno\.env\.get\(['"]([A-Z_]+)['"]\)/g)) names.add(m[1]);
      } catch { /* no index.ts */ }
    }
  } catch { /* no functions dir */ }
  return [...names].sort();
}

export function generateManifest({ prodRef = DEFAULT_PROD_REF, testGateResultPath = null } = {}) {
  const commitSha = git('rev-parse HEAD');
  const commitSubject = git('log -1 --format=%s');
  const branch = (() => { try { return git('rev-parse --abbrev-ref HEAD'); } catch { return null; } })();

  let testGateResult = null;
  if (testGateResultPath) {
    try { testGateResult = JSON.parse(readFileSync(testGateResultPath, 'utf-8')); } catch { testGateResult = { error: 'could not read test gate result file' }; }
  }

  return {
    generatedAt: new Date().toISOString(),
    frontend: { commitSha, commitSubject, branch },
    migrationSet: localMigrationSet(),
    edgeFunctions: getFunctionList(prodRef),
    requiredConfigNames: localRequiredConfigNames(),
    testGateResult,
    productionSmokeResult: null, // filled in manually or by a future Gate E script after deploy
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const prodRefIdx = args.indexOf('--prod-ref');
  const testGateIdx = args.indexOf('--test-gate-result');
  const manifest = generateManifest({
    prodRef: prodRefIdx !== -1 ? args[prodRefIdx + 1] : undefined,
    testGateResultPath: testGateIdx !== -1 ? args[testGateIdx + 1] : undefined,
  });
  const json = JSON.stringify(manifest, null, 2);
  if (outIdx !== -1) {
    writeFileSync(args[outIdx + 1], json);
    console.log(`Release manifest written to ${args[outIdx + 1]}`);
  } else {
    console.log(json);
  }
}
