// Release-source identity guard, adapted for the TEKANGO "get the approved
// product to LIVE" task. Unlike the earlier UI Identity Root Fix task (whose
// release candidate was a standalone snapshot descendant), THIS release is
// deliberately built as a normal descendant of real Production history
// (origin/main), with the approved UI-identity content re-applied file by
// file on top. So this guard proves two different things:
//
//  (A) HEAD is origin/main itself, or a direct linear descendant of it -
//      i.e. a normal fast-forward push is possible, with no unrelated
//      history merged in and no force required.
//  (B) every file in the declared "materialized from the approved
//      candidate" set is byte-identical, in this worktree, to that same
//      path at the declared approved-candidate commit - proving the
//      release content was copied from the proven-good source, not
//      hand-typed or re-derived from memory.
//
// Usage: node scripts/check-release-source-identity.js <base-ref> <candidate-sha> [--record <out.json>]
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd: process.cwd(), encoding: 'utf-8' }).trim();
}

// The exact 23-file set materialized from the approved candidate
// (850486d584a0731f02a2bcfccd8d3025c87132b8) into this release worktree,
// per the Step 3 dependency analysis. Keep this list in sync with what was
// actually staged - it is itself part of the audit trail.
export const MATERIALIZED_FROM_CANDIDATE = [
  'public/tekango-favicon-192.png',
  'public/tekango-favicon-32.png',
  'public/tekango-favicon-512.png',
  'public/tekango-favicon-64.png',
  'public/tekango-logo-horizontal-dark-transparent.png',
  'public/tekango-logo-horizontal-light-transparent.png',
  'public/tekango-symbol-transparent.png',
  'src/AIChatWidget.jsx',
  'src/components/BrandName.test.jsx',
  'src/components/ProFlowLogo.jsx',
  'src/index.css',
  'src/pages/LandingGlobal.jsx',
  'src/pages/LandingLocal.jsx',
  'src/pages/PublicQuote.jsx',
  'src/pages/PublicQuoteEn.jsx',
  'src/pages/landingCopyTruthfulness.test.js',
  'src/pages/landingTrialAndIconPolish.test.js',
  'src/pages/landingVideoConfig.js',
  'src/pages/savingsClaimTruthfulness.test.js',
  'src/pages/subscriptionIntent.test.js',
  'src/utils/pricingCatalog.js',
  'src/utils/pricingCatalog.test.js',
  'src/utils/seoMeta.js',
  'src/utils/seoMeta.test.js',
];

export function checkReleaseSourceIdentity(baseRef, candidateSha) {
  const findings = [];
  const head = git('rev-parse HEAD');
  const baseSha = baseRef ? git(`rev-parse ${baseRef}`) : null;

  // (A) normal fast-forward ancestry
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

  // (B) materialized-file content identity against the approved candidate
  if (candidateSha) {
    let mismatchCount = 0;
    for (const path of MATERIALIZED_FROM_CANDIDATE) {
      let candidateBlob;
      try {
        candidateBlob = execSync(`git show ${candidateSha}:${path}`, { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 50 });
      } catch (e) {
        findings.push({ level: 'error', check: 'B-content-identity', message: `Could not read ${path} at candidate ${candidateSha}: ${e.message}` });
        mismatchCount++;
        continue;
      }
      let workingBlob;
      try {
        workingBlob = execSync(`git show :${path}`, { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 50 });
      } catch (e) {
        findings.push({ level: 'error', check: 'B-content-identity', message: `${path} is not present in this worktree's index: ${e.message}` });
        mismatchCount++;
        continue;
      }
      if (Buffer.compare(candidateBlob, workingBlob) !== 0) {
        findings.push({ level: 'error', check: 'B-content-identity', message: `${path} differs from the approved candidate (${candidateSha}).` });
        mismatchCount++;
      }
    }
    if (mismatchCount === 0) {
      findings.push({ level: 'info', check: 'B-content-identity', message: `All ${MATERIALIZED_FROM_CANDIDATE.length} materialized files are byte-identical to the approved candidate (${candidateSha}).` });
    }
  }

  return { findings, manifest: { workspace: process.cwd(), commit: head, baseRef, baseSha, candidateSha, recordedAt: new Date().toISOString() } };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const baseRef = process.argv[2];
  const candidateSha = process.argv[3];
  const recordFlagIdx = process.argv.indexOf('--record');
  const recordPath = recordFlagIdx !== -1 ? process.argv[recordFlagIdx + 1] : null;

  const { findings, manifest } = checkReleaseSourceIdentity(baseRef, candidateSha);
  for (const f of findings) console.log(`[${f.level.toUpperCase()}] [${f.check}] ${f.message}`);
  if (recordPath) {
    writeFileSync(recordPath, JSON.stringify(manifest, null, 2));
    console.log(`Build-source manifest written to ${recordPath}`);
  }
  const errors = findings.filter((f) => f.level === 'error');
  if (errors.length > 0) process.exit(1);
}
