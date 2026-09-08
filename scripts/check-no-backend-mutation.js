// Backend-mutation guard, specific to the TEKANGO "get the approved product
// to LIVE" task. Proves, using git evidence only, that this release's
// staged changes relative to a base ref touch NO Supabase Edge Function,
// migration, RLS policy, or backend-contract file - i.e. this is a
// frontend-only release with zero Production backend footprint.
//
// Usage: node scripts/check-no-backend-mutation.js <base-ref>
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd: process.cwd(), encoding: 'utf-8' }).trim();
}

const BACKEND_PATH_PREFIXES = ['supabase/'];

export function checkNoBackendMutation(baseRef = 'origin/main') {
  const findings = [];
  let baseFiles;
  try {
    baseFiles = git(`ls-tree -r --name-only ${baseRef}`).split('\n').filter(Boolean);
  } catch (e) {
    findings.push({ level: 'error', check: 'no-backend-diff', message: `Could not read base ref ${baseRef}: ${e.message}` });
    return findings;
  }
  const currentFiles = git('ls-files').split('\n').filter(Boolean);

  const isBackend = (f) => BACKEND_PATH_PREFIXES.some((p) => f.startsWith(p));
  const baseBackend = new Map();
  for (const f of baseFiles.filter(isBackend)) {
    try {
      baseBackend.set(f, git(`rev-parse ${baseRef}:${f}`));
    } catch { /* ignore */ }
  }
  const currentBackend = currentFiles.filter(isBackend);

  const changed = [];
  for (const f of currentBackend) {
    let currentBlobSha;
    try {
      currentBlobSha = git(`rev-parse :${f}`);
    } catch { currentBlobSha = null; }
    if (!baseBackend.has(f)) {
      changed.push(`${f} (new, not in ${baseRef})`);
    } else if (baseBackend.get(f) !== currentBlobSha) {
      changed.push(`${f} (content differs from ${baseRef})`);
    }
  }
  const removed = [...baseBackend.keys()].filter((f) => !currentFiles.includes(f));
  for (const f of removed) changed.push(`${f} (removed relative to ${baseRef})`);

  if (changed.length > 0) {
    findings.push({ level: 'error', check: 'no-backend-diff', message: `Backend path(s) differ from ${baseRef}: ${changed.join(', ')}` });
  } else {
    findings.push({ level: 'info', check: 'no-backend-diff', message: `Zero backend-path (supabase/) changes relative to ${baseRef} - this release has no Production backend footprint.` });
  }

  return findings;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const baseRef = process.argv[2] || 'origin/main';
  const findings = checkNoBackendMutation(baseRef);
  for (const f of findings) console.log(`[${f.level.toUpperCase()}] [${f.check}] ${f.message}`);
  const errors = findings.filter((f) => f.level === 'error');
  if (errors.length > 0) process.exit(1);
  else console.log('\nNo-backend-mutation gate: PASS');
}
