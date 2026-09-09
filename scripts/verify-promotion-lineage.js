// Promotion-lineage guard (Gate C: "promotion, not reconstruction").
//
// Final Orphan Wiring + TEST Secrets Closure task (2026-09-09): Gate C was
// repeatedly reported as "structurally true but untooled" across §217-§220 -
// every release since the Release Isolation Law (PROFLOW_PROJECT_CONTEXT.md
// §205) happened to be built from a fresh worktree branched off origin/main,
// but nothing actually VERIFIED that before a push, so the guarantee rested
// on discipline alone. The one prior attempt at tooling this
// (check-release-source-identity.js) hardcodes one specific historical
// release's own file list and is not reusable for a different release.
//
// This script is the general, permanent, reusable replacement: it proves,
// for whatever the current HEAD is, that a normal fast-forward push to
// origin/main is possible - i.e. HEAD is origin/main itself or a genuine
// linear descendant of it, never a reconstructed/rebased/unrelated history -
// and that the working tree is clean (a release must never carry
// uncommitted local-only differences). It takes no file list and needs no
// per-release editing, so it can run before every future release exactly
// like check-test-live-parity.js already does for structural parity.
//
// Read-only: runs `git fetch` (network read only, never a push/mutation)
// plus local `git rev-parse`/`merge-base`/`status` calls. Never touches the
// working tree's content.
//
// Usage: node scripts/verify-promotion-lineage.js [--base origin/main] [--skip-fetch]
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf-8' }).trim();
}

export function verifyPromotionLineage({ base = 'origin/main', skipFetch = false } = {}) {
  const findings = [];

  if (!skipFetch) {
    try {
      const [remote] = base.split('/');
      git(['fetch', remote, '--quiet']);
      findings.push({ level: 'info', check: 'fetch', message: `Fetched ${base.split('/')[0]} before checking ancestry - comparing against its real current tip, not a stale local copy.` });
    } catch (e) {
      findings.push({ level: 'error', check: 'fetch', message: `git fetch failed: ${e.message} - ancestry check below may be comparing against a stale local ref.` });
    }
  }

  const head = git(['rev-parse', 'HEAD']);
  let baseSha;
  try {
    baseSha = git(['rev-parse', base]);
  } catch (e) {
    findings.push({ level: 'error', check: 'base-ref', message: `Could not resolve base ref "${base}": ${e.message}` });
    return { ok: false, findings, head, base, baseSha: null };
  }

  if (head === baseSha) {
    findings.push({ level: 'info', check: 'ancestry', message: `HEAD (${head}) is exactly ${base} - nothing to promote yet, or a no-op check.` });
  } else {
    let isDescendant = false;
    try {
      git(['merge-base', '--is-ancestor', baseSha, head]);
      isDescendant = true;
    } catch { /* not an ancestor - exit code 1 from git, not a real error */ }
    if (!isDescendant) {
      findings.push({
        level: 'error', check: 'ancestry',
        message: `HEAD (${head}) is NOT a descendant of ${base} (${baseSha}) - this is reconstruction, not promotion. A normal fast-forward push would fail or require force/rebase. Rebuild this release from a fresh checkout of ${base} instead.`,
      });
    } else {
      findings.push({ level: 'info', check: 'ancestry', message: `HEAD (${head}) is a genuine linear descendant of ${base} (${baseSha}) - a normal fast-forward push is possible.` });
    }
  }

  const dirty = git(['status', '--porcelain']);
  if (dirty) {
    findings.push({
      level: 'error', check: 'clean-tree',
      message: `Working tree has uncommitted changes - a release must be built entirely from committed history, never from local-only edits:\n${dirty}`,
    });
  } else {
    findings.push({ level: 'info', check: 'clean-tree', message: 'Working tree is clean - nothing uncommitted is riding along with this release.' });
  }

  const ok = findings.every((f) => f.level !== 'error');
  return { ok, findings, head, base, baseSha };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const baseIdx = args.indexOf('--base');
  const result = verifyPromotionLineage({
    base: baseIdx !== -1 ? args[baseIdx + 1] : undefined,
    skipFetch: args.includes('--skip-fetch'),
  });
  for (const f of result.findings) console.log(`[${f.level.toUpperCase()}] [${f.check}] ${f.message}`);
  console.log(`\nRESULT: ${result.ok ? 'PROMOTION LINEAGE VERIFIED' : 'GATE C FAILED - see errors above'}`);
  process.exit(result.ok ? 0 : 1);
}
