// Release-source identity guard, adapted for the TEKANGO "authenticated UI
// to LIVE" task. This release's source of truth is the canonical dirty TEST
// working tree (the checkout actually serving the Owner-approved authenticated
// UI at the local TEST dev server) - not a commit SHA, since that tree has
// uncommitted changes on top of its own HEAD. So this guard proves:
//
//  (A) HEAD is origin/main itself, or a direct linear descendant of it -
//      i.e. a normal fast-forward push is possible, with no unrelated
//      history merged in and no force required.
//  (B) every file in the declared "materialized verbatim from the approved
//      TEST working tree" set is byte-identical, in this worktree, to that
//      same path in the canonical dirty TEST tree on disk - proving the
//      release content was copied from the proven-good source, not
//      hand-typed or re-derived from memory.
//  (C) the two surgically-modified files (Dashboard.jsx, index.css) are
//      NOT included in (B)'s byte-identity check by design - they were
//      deliberately, minimally edited to strip Production-unsafe backend
//      calls while preserving the approved UI; their safety is proven
//      instead by check-no-migration-execution.js / check-no-backend-
//      mutation.js, and this guard just records that fact for the audit
//      trail rather than silently omitting them.
//
// Usage: node scripts/check-release-source-identity.js <base-ref> <canonical-tree-path> [--record <out.json>]
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd: process.cwd(), encoding: 'utf-8' }).trim();
}

// The exact file set copied verbatim (byte-for-byte) from the canonical
// dirty TEST working tree into this release worktree, per the Step 2/3
// dependency analysis. Keep in sync with what was actually materialized.
export const MATERIALIZED_VERBATIM = [
  'src/components/PlanIdentityBadge.jsx',
  'src/components/PlanIdentityBadge.test.jsx',
  'src/components/ClientsTab.jsx',
  'src/components/ClientsTab.test.jsx',
  'src/components/QuotesTab.jsx',
  'src/components/QuotesTab.test.jsx',
  'src/components/FinancesTab.jsx',
  'src/components/ServicesCatalog.jsx',
  'src/components/SettingsTab.jsx',
  'src/components/QuoteForm.jsx',
  'src/components/QuoteForm.test.jsx',
  'src/components/AddItemWizard.jsx',
  'src/components/AddItemWizard.test.jsx',
  'src/components/EditClientModal.jsx',
  'src/components/AccessibilityModal.jsx',
  'src/components/PricingModal.jsx',
  'src/components/AdminUsersTab.jsx',
  'src/theme/neonTheme.js',
  'src/utils/accountEntitlement.js',
  'src/utils/accountEntitlement.test.js',
  'src/utils/planCatalog.js',
  'src/utils/planCatalog.test.js',
  'src/utils/professionalQuoteItem.js',
  'src/utils/professionalQuoteItem.test.js',
  'src/utils/clientSort.js',
  'src/utils/clientSort.test.js',
  'src/utils/logoTrim.js',
  'src/utils/logoTrim.test.js',
  'src/pages/Dashboard.hotquote.test.js',
];

// Surgically-modified (not byte-identical by design) - see module comment.
export const SURGICALLY_MODIFIED = [
  'src/pages/Dashboard.jsx',
  'src/index.css',
];

export function checkReleaseSourceIdentity(baseRef, canonicalTreePath) {
  const findings = [];
  const head = git('rev-parse HEAD');
  const baseSha = baseRef ? git(`rev-parse ${baseRef}`) : null;

  if (baseSha) {
    if (head === baseSha) {
      findings.push({ level: 'info', check: 'A-ff-ancestry', message: `HEAD exactly matches ${baseRef} (${baseSha}) - nothing committed yet, or a no-op release.` });
    } else {
      let isDescendant = false;
      try {
        git(`merge-base --is-ancestor ${baseSha} ${head}`);
        isDescendant = true;
      } catch { /* not an ancestor */ }
      if (!isDescendant) {
        findings.push({ level: 'error', check: 'A-ff-ancestry', message: `HEAD (${head}) is not a descendant of ${baseRef} (${baseSha}) - a normal fast-forward push would not be possible.` });
      } else {
        findings.push({ level: 'info', check: 'A-ff-ancestry', message: `HEAD (${head}) is a direct descendant of ${baseRef} (${baseSha}) - a normal fast-forward push is possible.` });
      }
    }
  }

  if (canonicalTreePath) {
    let mismatchCount = 0;
    for (const path of MATERIALIZED_VERBATIM) {
      const canonicalFile = join(canonicalTreePath, path);
      const workingFile = join(process.cwd(), path);
      if (!existsSync(canonicalFile)) {
        findings.push({ level: 'error', check: 'B-content-identity', message: `${path} not found in canonical tree at ${canonicalFile}.` });
        mismatchCount++;
        continue;
      }
      if (!existsSync(workingFile)) {
        findings.push({ level: 'error', check: 'B-content-identity', message: `${path} not found in this worktree.` });
        mismatchCount++;
        continue;
      }
      const a = readFileSync(canonicalFile);
      const b = readFileSync(workingFile);
      if (Buffer.compare(a, b) !== 0) {
        findings.push({ level: 'error', check: 'B-content-identity', message: `${path} differs from the canonical dirty TEST tree.` });
        mismatchCount++;
      }
    }
    if (mismatchCount === 0) {
      findings.push({ level: 'info', check: 'B-content-identity', message: `All ${MATERIALIZED_VERBATIM.length} verbatim-materialized files are byte-identical to the canonical dirty TEST tree.` });
    }
    findings.push({ level: 'info', check: 'C-surgical-exclusions-declared', message: `${SURGICALLY_MODIFIED.length} file(s) deliberately excluded from byte-identity check (surgically modified for backend safety): ${SURGICALLY_MODIFIED.join(', ')}. See check-no-migration-execution.js / check-no-backend-mutation.js.` });
  }

  return { findings, manifest: { workspace: process.cwd(), commit: head, baseRef, baseSha, canonicalTreePath, recordedAt: new Date().toISOString() } };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const baseRef = process.argv[2];
  const canonicalTreePath = process.argv[3];
  const recordFlagIdx = process.argv.indexOf('--record');
  const recordPath = recordFlagIdx !== -1 ? process.argv[recordFlagIdx + 1] : null;

  const { findings, manifest } = checkReleaseSourceIdentity(baseRef, canonicalTreePath);
  for (const f of findings) console.log(`[${f.level.toUpperCase()}] [${f.check}] ${f.message}`);
  if (recordPath) {
    writeFileSync(recordPath, JSON.stringify(manifest, null, 2));
    console.log(`Build-source manifest written to ${recordPath}`);
  }
  const errors = findings.filter((f) => f.level === 'error');
  if (errors.length > 0) process.exit(1);
}
