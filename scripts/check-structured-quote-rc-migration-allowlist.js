// Release-specific migration safety guard for THIS RC only: "Structured
// Quote / Smart Quote Production Migration Package Review" (Owner-
// authorized pre-production package-prep task, 2026-09-15; hardened
// 2026-09-15 in response to an independent Codex NO-GO review, blocker 7).
//
// Why a NEW guard instead of reusing/editing scripts/check-no-migration-
// execution.js: that script was written for a PRIOR, unrelated release
// ("get the approved product to LIVE") whose own explicit mandate was "ship
// ZERO Supabase migrations, period" - it hardcodes exactly three filenames
// as forbidden (20260902/903/904) purely because THAT release could not
// contain them at all, for reasons specific to that release's own scope.
// This release's mandate is the opposite of that one: it explicitly SHOULD
// prepare a Production-forward migration package. This file remains
// additive - it does not modify, weaken, or delete
// check-no-migration-execution.js or its own tests in any way.
//
// Codex NO-GO remediation (blocker 7) - what changed from the prior version
// of this guard, and why each change closes a real fail-open gap:
//
// 9.1 EXACT FILE IDENTITY: the allowlist now pins a SHA-256 for each of the
//     4 files, not just a filename. Any content change under an allowed
//     filename now fails closed instead of silently passing.
// 9.2 NO PREFIX LOOPHOLE: the prior version's CLI entry point classified
//     "already applied, not this RC's concern" local files via
//     `f.startsWith(p)` against a handful of short date prefixes (e.g.
//     '20260827') - a file like `20260827999999_smuggled.sql` would have
//     silently passed as "known already applied". Replaced with an EXACT
//     filename list (KNOWN_ALREADY_APPLIED_FILES) and, for real release
//     use, a live classification against a FRESH remote migration ledger
//     read (classifyAgainstRemoteLedger) - never inferred from a filename
//     prefix alone.
// 9.3 MISSING-FILE DETECTION, NO SEPARATE WEAKER PATH: the prior version's
//     `if (import.meta.url === ...)` CLI entry point ran its OWN inline,
//     weaker check (extra-file detection only) instead of calling the
//     complete classifier - it never verified all 4 required package files
//     actually exist. The CLI entry point below now calls
//     verifyExactFileIdentityAndOrder() directly - the same function any
//     other caller/test uses - so there is exactly one classification path,
//     not two.
// 9.4 REMOTE LEDGER AWARENESS: classifyAgainstRemoteLedger() takes the
//     pending/applied split from a FRESH `supabase migration list
//     --output-format json` read (never inferred from local file state
//     alone) and fails closed on anything not exactly one of: an allowed
//     package file, a documented exclusion, or (for the Lifetime file only)
//     confirmed still-applied.
// 9.5 ISOLATED EXECUTION DIRECTORY: the prior version's
//     runIsolatedDryRunProof() relocated excluded files OUT of the live,
//     dirty canonical worktree's own supabase/migrations/ directory and
//     back - a real (if reversible) mutation of the working tree being
//     released from. The new version never touches the canonical
//     migrations directory at all: it builds a brand-new, disposable
//     directory (via buildIsolatedReleaseDirectory(), under a fresh
//     mkdtempSync() temp path) containing ONLY copies of the exact
//     already-applied files (from a fresh remote ledger read) plus the 4
//     allowed package files, then runs `supabase db push --dry-run
//     --workdir <that isolated dir>` - the canonical worktree is read-only
//     throughout, and the isolated directory is always removed in a
//     `finally` block, even on error.
// 9.6 REAL DRY-RUN PARSER: the prior version searched for the first literal
//     "{" in the CLI's raw text output - fragile, and not how this CLI
//     actually structures --output-format json output (confirmed by
//     actually running `supabase db push --dry-run --output-format json`
//     and `supabase migration list --output-format json` against a real
//     disposable local Postgres during this remediation: the CLI still
//     prints its human-readable progress lines to stdout FIRST, then the
//     JSON result object as the LAST non-empty line - never plain-only
//     JSON). parseDryRunOutput()/parseMigrationListOutput() below parse
//     only that last line and validate its shape; --output-format json is
//     now passed explicitly on every CLI invocation this file makes.
// 9.7 Test coverage added for every scenario the remediation task
//     enumerated - see check-structured-quote-rc-migration-allowlist.test.js.
//
// SECOND PASS (2026-09-15, same day) - a further independent Codex
// re-review of the above reduced the NO-GO to exactly 3 remaining
// blockers, all closed in this same file:
//   1. service_role EXECUTE was not explicitly revoked in the RPC
//      migration itself (guard-adjacent: this file's pinned hashes were
//      recomputed after that migration edit) - see
//      20260917000003_prod_forward_save_quote_structured_atomic_function.sql.
//   2. runIsolatedDryRunProof() could be called without first enforcing
//      pinned file identity - fixed: it now calls
//      verifyExactFileIdentityAndOrder() as its very first step, before any
//      network call, printing/returning a "MIGRATION FILE IDENTITY:
//      PASS"/FAIL gate.
//   3. The ledger classifier silently discarded remote-only rows
//      (`if (!m.local) continue`) and had no way to detect an excluded
//      migration (e.g. 20260909) being unexpectedly applied out-of-band,
//      since it only ever received a pre-filtered PENDING list. Replaced
//      wholesale: REMOTE_LEDGER_BASELINE + classifyFreshLedger() now
//      operate on the FULL fresh ledger (every row, applied and pending)
//      and fail closed on a remote-only row, an unknown entry, or any
//      unexpected applied-state transition. classifyAgainstRemoteLedger()
//      is removed (superseded) - it structurally could not see what this
//      pass needed it to see.
//
// The underlying safety concern that remains valid across every release:
// an uncontrolled `supabase db push` must never be allowed to sweep
// arbitrary/forbidden migrations into Production. Fails closed: anything
// not exactly classifiable as the allowed package, a documented exclusion,
// or a confirmed-already-applied file blocks the check.
import { readdirSync, existsSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const DEFAULT_PROD_REF = 'ixabnzhjeqevtbhdfswv';

// The exact, smallest-necessary-delta Production forward package this RC
// produced (PROFLOW Structured Quote Production Migration Package Review,
// 2026-09-15, remediated same day for Codex NO-GO blockers 1-6). Order
// matters (apply order = array order = filename-sorted order) and content
// is pinned by SHA-256 - computed directly from each file on disk via
// `node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync(<file>)).digest('hex'))"`
// immediately after this same remediation task finished editing all 4
// files. A future edit to any of these files MUST recompute and update its
// hash here in the same commit/change, or this guard fails closed.
export const ALLOWED_PRODUCTION_FORWARD_MIGRATIONS = [
  {
    file: '20260917000000_prod_forward_professional_quote_items_stage_a.sql',
    sha256: 'f59279ba858c026cd99e3f5ccbc6b13efa33453c2a36fd4d61521f585824462f',
  },
  {
    file: '20260917000001_prod_forward_business_professional_domain.sql',
    sha256: 'eddfa64b9b3f3592fad4a5cdacb4472d4a523740d0f5d654842e80d9ff7998b1',
  },
  {
    file: '20260917000002_prod_forward_professional_quote_hierarchy.sql',
    sha256: 'ef3e1ac26256005a9ec9431e190f2ab31132fbe7f43168de08d079ca267d20e4',
  },
  {
    file: '20260917000003_prod_forward_save_quote_structured_atomic_function.sql',
    sha256: '5185f19b75dcde35eddbb4a4a4746139aef2f03939ee14965762ed904dc439af',
  },
];

// Every other migration file this repo currently holds that is NOT yet
// applied to Production, with the explicit, reviewed reason it must stay
// excluded from this RC. A file landing in neither this set nor the
// allowlist above is unexpected and fails the check closed.
export const EXCLUDED_PENDING_MIGRATIONS = {
  '20260830000000_capture_base_schema_tables.sql': 'bootstrap/capture artifact - documents Production-native pre-existing objects for TEST bootstrap only, never a Production forward-migration path',
  '20260830000001_capture_base_functions_triggers.sql': 'bootstrap/capture artifact - same as above',
  '20260830000002_capture_base_rls_grants.sql': 'bootstrap/capture artifact - same as above',
  '20260830000003_capture_base_storage.sql': 'bootstrap/capture artifact - same as above',
  '20260830000004_add_warranty_fields.sql': 'bootstrap/capture artifact - same as above',
  '20260902000000_add_professional_quote_items_stage_a.sql': 'superseded by 20260917000000_prod_forward_professional_quote_items_stage_a.sql - same content, reissued as the Production-forward record; the original TEST-history file is preserved for provenance but must never itself be pushed to Production',
  '20260903000000_add_business_professional_domain.sql': 'superseded by 20260917000001_prod_forward_business_professional_domain.sql - see above',
  '20260904000000_add_professional_quote_hierarchy.sql': 'superseded by 20260917000002_prod_forward_professional_quote_hierarchy.sql - see above',
  '20260909000000_narrow_public_approve_quote_to_owner_only.sql': 'EXCLUDED per explicit Owner instruction for this RC - not proven a mandatory dependency of Structured Quote itself; requires separate Owner authorization',
  '20260915000000_add_save_quote_structured_atomic_function.sql': 'superseded by 20260917000003_prod_forward_save_quote_structured_atomic_function.sql, which ships the FINAL hardened body directly - Production must never run this unhardened intermediate version, even momentarily',
  '20260916000000_harden_save_quote_structured_existing_id_validation.sql': 'superseded by 20260917000003_prod_forward_save_quote_structured_atomic_function.sql - see above',
};

// 20260908000000 (Lifetime) is deliberately NOT listed in either map above:
// fresh read-only evidence (supabase migration list --project-ref
// ixabnzhjeqevtbhdfswv, 2026-09-15) proved it is ALREADY applied to
// Production - it is not "pending" at all, so a pending-file allowlist has
// nothing to classify. It is asserted here as a standing, checkable fact
// so a future regression (e.g. someone deletes it from Production and it
// becomes "pending" again) is caught rather than silently reclassified.
export const LIFETIME_MIGRATION_FILE = '20260908000000_add_explicit_lifetime_state.sql';
export const LIFETIME_MUST_ALREADY_BE_APPLIED_TO_PROD = true;

// Every migration filename this repo's history independently confirms was
// already applied to Production BEFORE this RC's own review (per the fresh
// `supabase migration list --project-ref ixabnzhjeqevtbhdfswv` read
// recorded in PROFLOW_STRUCTURED_QUOTE_PRODUCTION_MIGRATION_PACKAGE_REVIEW.md
// Section B, re-confirmed fresh again during the Codex re-review
// remediation pass, 2026-09-15). EXACT filenames only - deliberately not a
// prefix list. Used only by the zero-network static CLI check below and as
// the default seed for building an isolated release directory when a fresh
// live ledger read is unavailable; runIsolatedDryRunProof() prefers a
// fresh live read over this constant whenever the CLI can actually reach
// Production.
//
// Codex re-review remediation, section 7 (exact baseline consistency) -
// found and fixed a real latent bug while building REMOTE_LEDGER_BASELINE
// below: this list previously ALSO included the 5 `20260830*`
// bootstrap/capture files, which are simultaneously (and correctly) listed
// in EXCLUDED_PENDING_MIGRATIONS above - the two lists disagreed with each
// other. A fresh `migration list --project-ref ixabnzhjeqevtbhdfswv` read
// confirms the truth: `20260830000000-4` all show `remote: ""` (NOT
// applied) - EXCLUDED_PENDING_MIGRATIONS was right, this list was wrong.
// Removed here; they remain correctly classified as pending-excluded via
// EXCLUDED_PENDING_MIGRATIONS only.
export const KNOWN_ALREADY_APPLIED_FILES = [
  '20260827000000_add_quote_number_sequence.sql',
  '202608270000015_attach_quote_number_unique_constraint.sql',
  '20260827000001_add_quote_number_unique_index.sql',
  '20260827000002_protect_quote_number_immutability.sql',
  '20260827000003_drop_quote_number_default.sql',
  '20260828000000_add_quote_attn_contact.sql',
  '20260831000000_fix_public_approve_quote_business_check.sql',
  LIFETIME_MIGRATION_FILE,
];

// Filenames that must NEVER appear in a real dry-run's proposed migration
// list for this RC, called out by name (not merely "not on the allowlist")
// so a violation produces an unambiguous, specific finding rather than a
// generic mismatch - these are the exact objects prior incidents/this
// review named as uniquely dangerous if ever actually pushed.
const KNOWN_DANGEROUS_IN_CANDIDATE_SET = new Set([
  LIFETIME_MIGRATION_FILE,
  ...Object.keys(EXCLUDED_PENDING_MIGRATIONS),
]);

function localMigrationFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
}

export function computeFileSha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

// Blocker 7 / 9.1 + 9.7 "allowed file content modified", "allowed file
// missing", "wrong order": verifies, against a real directory on disk,
// that every allowed package file (a) exists, (b) matches its pinned
// SHA-256 exactly, and (c) sorts into the exact required apply order
// relative to the other allowed files actually present in that directory.
// Pure filesystem check - no CLI, no network - safe to run on every commit.
export function verifyExactFileIdentityAndOrder(migrationsDir) {
  const findings = [];
  for (const { file, sha256 } of ALLOWED_PRODUCTION_FORWARD_MIGRATIONS) {
    const p = join(migrationsDir, file);
    if (!existsSync(p)) {
      findings.push({ level: 'error', check: 'package-file-missing', message: `Required package file missing: ${file}` });
      continue;
    }
    const actual = computeFileSha256(p);
    if (actual !== sha256) {
      findings.push({ level: 'error', check: 'package-file-hash-mismatch', message: `${file} content does not match its pinned SHA-256 - expected ${sha256}, got ${actual}. The file was modified after this RC's own review; re-review and re-pin before proceeding.` });
    }
  }
  if (findings.length > 0) return findings; // order is meaningless if a file is missing/corrupt

  const dirListing = localMigrationFiles(migrationsDir);
  const allowedNames = ALLOWED_PRODUCTION_FORWARD_MIGRATIONS.map((m) => m.file);
  const allowedNamesInDirOrder = dirListing.filter((f) => allowedNames.includes(f));
  if (JSON.stringify(allowedNamesInDirOrder) !== JSON.stringify(allowedNames)) {
    findings.push({
      level: 'error',
      check: 'package-wrong-order',
      message: `Package files are not in the required apply order. Expected ${JSON.stringify(allowedNames)}, found ${JSON.stringify(allowedNamesInDirOrder)}.`,
    });
  }
  return findings;
}

// Codex re-review remediation (2026-09-15, second pass), Section 7: the
// single, exact, reviewed classification authority for every migration
// version this repo is aware of - each filename maps to its EXPECTED
// state. Derived from the same three constants above so there is exactly
// one source of truth (no separate hand-maintained baseline that could
// silently drift from EXCLUDED_PENDING_MIGRATIONS/KNOWN_ALREADY_APPLIED_
// FILES/ALLOWED_PRODUCTION_FORWARD_MIGRATIONS). No prefix matching -
// object keys are exact filenames.
export const LEDGER_STATE_APPLIED = 'applied';
export const LEDGER_STATE_PENDING_EXCLUDED = 'pending-excluded';
export const LEDGER_STATE_PENDING_PACKAGE = 'pending-package';

export const REMOTE_LEDGER_BASELINE = Object.freeze({
  ...Object.fromEntries(KNOWN_ALREADY_APPLIED_FILES.map((f) => [f, LEDGER_STATE_APPLIED])),
  ...Object.fromEntries(Object.keys(EXCLUDED_PENDING_MIGRATIONS).map((f) => [f, LEDGER_STATE_PENDING_EXCLUDED])),
  ...Object.fromEntries(ALLOWED_PRODUCTION_FORWARD_MIGRATIONS.map((m) => [m.file, LEDGER_STATE_PENDING_PACKAGE])),
});

const NARROW_APPROVE_FILE = '20260909000000_narrow_public_approve_quote_to_owner_only.sql';

// Codex re-review remediation, blocker 3 (was: classifyAgainstRemoteLedger,
// which only ever received a pre-filtered PENDING list - structurally
// incapable of noticing a remote-only row or an unexpected applied-state
// transition, since both manifest as something OTHER than "an unexpected
// filename in the pending list"). This version takes the FULL fresh
// `migration list` result (both applied AND pending rows) and localFiles
// (the real local directory listing, for exact version->filename
// resolution), and fails closed on every scenario the task named:
//   - a row with remote set but no local file at all: REMOTE-ONLY
//     MIGRATION: FAIL (this is exactly what could hide an out-of-band
//     Production change - the prior version's `if (!m.local) continue`
//     silently discarded these rows entirely).
//   - a resolved local file with no entry in REMOTE_LEDGER_BASELINE:
//     unknown-ledger-entry, PRODUCTION DELTA CHANGED - STOP AND RECONCILE.
//   - a file expected 'applied' that is now pending: applied-state-
//     regression (catches Lifetime or any pre-908 file being rolled back).
//   - a file expected 'pending-excluded' (e.g. 20260909) that is now
//     applied: excluded-migration-unexpectedly-applied, PRODUCTION DELTA
//     CHANGED - FAIL. This is the exact scenario Section 6 names for
//     20260909, generalized to every documented exclusion, not just that
//     one file.
//   - a file expected 'pending-package' (this RC's own 4 files) that is
//     already applied outside this push: package-file-already-applied.
// Named, redundant-but-clearer checks for Lifetime and 20260909
// specifically are also included, since the task's own report format asks
// for their exact behavior by name.
export function classifyFreshLedger({ migrationListData, localFiles }) {
  const findings = [];
  const rows = migrationListData.migrations || [];

  for (const row of rows) {
    const remotePresent = Boolean(row.remote);
    const localPresent = Boolean(row.local);

    if (remotePresent && !localPresent) {
      findings.push({
        level: 'error',
        check: 'remote-only-migration',
        message: `REMOTE-ONLY MIGRATION: FAIL - version ${row.remote} is applied on Production but has no corresponding local migration file. This could hide an out-of-band Production change. STOP AND RECONCILE.`,
      });
      continue;
    }
    if (!localPresent) continue; // neither local nor remote present - not a real row

    let file;
    try {
      file = versionToFilename(row.local, localFiles);
    } catch (err) {
      findings.push({ level: 'error', check: 'unresolvable-ledger-version', message: err.message });
      continue;
    }

    const expected = REMOTE_LEDGER_BASELINE[file];
    const actual = remotePresent ? LEDGER_STATE_APPLIED : 'pending';

    if (!expected) {
      findings.push({ level: 'error', check: 'unknown-ledger-entry', message: `${file} is not in this RC's reviewed ledger baseline (neither known-already-applied, a documented exclusion, nor this RC's own package). PRODUCTION DELTA CHANGED — STOP AND RECONCILE.` });
      continue;
    }

    if (expected === LEDGER_STATE_APPLIED && actual !== LEDGER_STATE_APPLIED) {
      findings.push({ level: 'error', check: 'applied-state-regression', message: `${file} was expected already-applied to Production but a fresh ledger read shows it pending. PRODUCTION DELTA CHANGED — STOP AND RECONCILE.` });
    } else if (expected === LEDGER_STATE_PENDING_EXCLUDED && actual === LEDGER_STATE_APPLIED) {
      findings.push({ level: 'error', check: 'excluded-migration-unexpectedly-applied', message: `${file} is explicitly excluded from this RC (${EXCLUDED_PENDING_MIGRATIONS[file]}) but a fresh ledger read shows it now APPLIED to Production. PRODUCTION DELTA CHANGED — FAIL.` });
    } else if (expected === LEDGER_STATE_PENDING_PACKAGE && actual === LEDGER_STATE_APPLIED) {
      findings.push({ level: 'error', check: 'package-file-already-applied', message: `${file} is one of this RC's own 4 package files but a fresh ledger read shows it already applied to Production outside this push. Re-audit before proceeding.` });
    }
  }

  const resolvedFiles = new Set();
  for (const row of rows) {
    if (!row.local) continue;
    try { resolvedFiles.add(versionToFilename(row.local, localFiles)); } catch { /* already reported above */ }
  }
  const allowedNames = ALLOWED_PRODUCTION_FORWARD_MIGRATIONS.map((m) => m.file);
  const missingPackageFiles = allowedNames.filter((f) => !resolvedFiles.has(f));
  if (missingPackageFiles.length > 0) {
    findings.push({ level: 'error', check: 'package-files-present', message: `Expected Production-forward package file(s) not found in the fresh ledger read: ${missingPackageFiles.join(', ')}` });
  }

  // Named checks for Lifetime and 20260909 specifically (report clarity -
  // the generic loop above already independently catches both).
  const lifetimeVersion = LIFETIME_MIGRATION_FILE.split('_')[0];
  const lifetimeRow = rows.find((r) => r.local === lifetimeVersion);
  const lifetimeAppliedToProd = Boolean(lifetimeRow && lifetimeRow.remote);
  if (lifetimeAppliedToProd !== LIFETIME_MUST_ALREADY_BE_APPLIED_TO_PROD) {
    findings.push({ level: 'error', check: 'lifetime-state-unchanged', message: `Lifetime migration applied-state on Production changed since this RC's own audit (expected appliedToProd=${LIFETIME_MUST_ALREADY_BE_APPLIED_TO_PROD}, got ${lifetimeAppliedToProd}).` });
  }

  const narrowApproveVersion = NARROW_APPROVE_FILE.split('_')[0];
  const narrowApproveRow = rows.find((r) => r.local === narrowApproveVersion);
  const narrowApproveApplied = Boolean(narrowApproveRow && narrowApproveRow.remote);
  if (narrowApproveApplied) {
    findings.push({ level: 'error', check: 'version-09-unexpectedly-applied', message: `PRODUCTION DELTA CHANGED — FAIL: ${NARROW_APPROVE_FILE} was expected to remain excluded/pending but a fresh ledger read shows it now applied to Production.` });
  }

  return findings;
}

// Blocker 7 / 9.6 + 9.7: compares an ACTUAL dry-run's proposed migration
// list (from a real CLI call, parsed by parseDryRunOutput below) against
// the allowed package - exact set, exact order, and a named check for any
// specifically-dangerous file appearing at all (Lifetime, 20260909, any
// bootstrap/capture, any superseded TEST-only file).
export function compareDryRunProposal(proposedFiles) {
  const findings = [];
  const expected = ALLOWED_PRODUCTION_FORWARD_MIGRATIONS.map((m) => m.file);

  const dangerous = proposedFiles.filter((f) => KNOWN_DANGEROUS_IN_CANDIDATE_SET.has(f));
  if (dangerous.length > 0) {
    findings.push({ level: 'error', check: 'dangerous-migration-in-candidate-set', message: `Prohibited migration(s) present in the dry-run candidate set - must never be pushed by this RC: ${dangerous.join(', ')}` });
  }

  const unexpected = proposedFiles.filter((f) => !expected.includes(f) && !dangerous.includes(f));
  if (unexpected.length > 0) {
    findings.push({ level: 'error', check: 'unexpected-migration-in-candidate-set', message: `Unexpected migration(s) in the dry-run candidate set, not part of the reviewed 4-file package: ${unexpected.join(', ')}` });
  }

  const missing = expected.filter((f) => !proposedFiles.includes(f));
  if (missing.length > 0) {
    findings.push({ level: 'error', check: 'package-incomplete-in-candidate-set', message: `Expected package file(s) missing from the dry-run candidate set: ${missing.join(', ')}` });
  }

  if (dangerous.length === 0 && unexpected.length === 0 && missing.length === 0) {
    const isExactOrderMatch = proposedFiles.length === expected.length && proposedFiles.every((f, i) => f === expected[i]);
    if (!isExactOrderMatch) {
      findings.push({ level: 'error', check: 'candidate-set-wrong-order', message: `Dry-run candidate set contains exactly the 4 right files but in the wrong order. Expected ${JSON.stringify(expected)}, got ${JSON.stringify(proposedFiles)}.` });
    }
  }

  return { pass: findings.length === 0, findings, proposed: proposedFiles, expected };
}

// Blocker 7 / 9.6: parses the REAL shape this CLI version actually emits
// for `--output-format json` (confirmed by running it for real against a
// disposable local Postgres during this remediation - see this file's own
// test for the exact captured fixture): human-readable progress lines to
// stdout first, then the JSON result object as the LAST non-empty line.
// Never scans blindly for the first "{" anywhere in the output.
export function parseDryRunOutput(rawOutput) {
  const lines = rawOutput.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) throw new Error('Empty dry-run output - cannot parse.');
  const lastLine = lines[lines.length - 1];
  let data;
  try {
    data = JSON.parse(lastLine);
  } catch {
    throw new Error(`Dry-run output's last line is not valid JSON (did the CLI change its --output-format json shape?): ${lastLine}`);
  }
  if (typeof data !== 'object' || data === null || !Array.isArray(data.migrations)) {
    throw new Error(`Dry-run JSON output is missing the expected "migrations" array field: ${lastLine}`);
  }
  return data;
}

// Same parsing discipline as parseDryRunOutput, for `supabase migration
// list --output-format json`. Real captured shape:
// {"migrations":[{"local":"<version>","remote":"<version-or-empty>","time":"..."}...],"message":"..."}
export function parseMigrationListOutput(rawOutput) {
  const lines = rawOutput.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) throw new Error('Empty migration-list output - cannot parse.');
  const lastLine = lines[lines.length - 1];
  let data;
  try {
    data = JSON.parse(lastLine);
  } catch {
    throw new Error(`Migration-list output's last line is not valid JSON: ${lastLine}`);
  }
  if (typeof data !== 'object' || data === null || !Array.isArray(data.migrations)) {
    throw new Error(`Migration-list JSON output is missing the expected "migrations" array field: ${lastLine}`);
  }
  return data;
}

// Splits a parsed `migration list` result into applied-version and
// pending-version arrays. A version counts as pending when it has a local
// entry but an empty/missing "remote" value (confirmed real shape: an
// empty string "", not null/absent, for a not-yet-applied version).
export function splitAppliedAndPendingVersions(migrationListData) {
  const appliedVersions = [];
  const pendingVersions = [];
  for (const m of migrationListData.migrations || []) {
    if (!m.local) continue;
    if (m.remote) appliedVersions.push(m.local);
    else pendingVersions.push(m.local);
  }
  return { appliedVersions, pendingVersions };
}

// Resolves a bare version string (e.g. "20260917000000") to its exact local
// filename by matching the version as a full, unique filename PREFIX up to
// and including the separating underscore - not a fuzzy/short prefix. This
// is safe (not the 9.2 loophole) because Supabase migration versions are
// globally-unique 14-digit timestamps and every filename is, by this
// project's own convention, exactly `${version}_${description}.sql` - the
// match can only ever hit the one real file for that exact version.
export function versionToFilename(version, localFiles) {
  const match = localFiles.find((f) => f === `${version}.sql` || f.startsWith(`${version}_`));
  if (!match) {
    throw new Error(`PRODUCTION DELTA CHANGED — STOP AND RECONCILE: a fresh remote ledger names version ${version}, but no local migration file starts with "${version}_". The local package and Production's real applied state have diverged since this RC was reviewed.`);
  }
  return match;
}

// Blocker 7 / 9.5: builds a brand-new, disposable release directory
// containing ONLY copies of the given already-applied files plus the 4
// allowed package files - never touches sourceMigrationsDir. Caller owns
// cleanup (runIsolatedDryRunProof always removes it in a `finally` block).
export function buildIsolatedReleaseDirectory({ sourceMigrationsDir, destDir, alreadyAppliedFiles }) {
  const destMigrationsDir = join(destDir, 'supabase', 'migrations');
  mkdirSync(destMigrationsDir, { recursive: true });
  writeFileSync(join(destDir, 'supabase', 'config.toml'), 'project_id = "structured-quote-rc-isolated-release-check"\n');

  const toCopy = [...alreadyAppliedFiles, ...ALLOWED_PRODUCTION_FORWARD_MIGRATIONS.map((m) => m.file)];
  const copied = [];
  for (const file of toCopy) {
    const from = join(sourceMigrationsDir, file);
    if (!existsSync(from)) {
      throw new Error(`Cannot build isolated release directory - required file missing from source migrations directory: ${file}`);
    }
    copyFileSync(from, join(destMigrationsDir, file));
    copied.push(file);
  }
  return { destDir, destMigrationsDir, copied };
}

// Blocker 7 / 9.5 + 9.7 "cleanup on failure": creates a fresh temp
// directory, runs fn(destDir), and ALWAYS removes the directory afterward -
// including when fn throws (the error still propagates to the caller after
// cleanup runs). Isolated as its own function specifically so the cleanup
// guarantee is independently unit-testable without needing a real network
// call to the Supabase CLI.
export function withTempIsolatedDirectory(scratchRoot, fn) {
  const destDir = mkdtempSync(join(scratchRoot, 'sq-rc-isolated-'));
  try {
    return fn(destDir);
  } finally {
    rmSync(destDir, { recursive: true, force: true });
  }
}

// Orchestration (NOT unit-tested with a real network call for the ledger-
// read/dry-run steps - calls the real Supabase CLI against Production,
// read-only via --dry-run only, never mutates; the file-identity gate at
// the top IS safely unit-testable offline, and is tested - see this file's
// own test suite). Reproduces the manual isolation proof this RC's own
// review performed, corrected for blocker 7 and further hardened for the
// Codex re-review's blockers 2 and 3:
// (0) [Codex re-review blocker 2] verifyExactFileIdentityAndOrder() runs
//     FIRST, before any network call - "MIGRATION FILE IDENTITY: PASS" (or
//     a fail-closed return) gates every later step. There is exactly ONE
//     execution path into a real dry-run: through this function, through
//     this gate. Content drift, a missing file, or wrong order stops here,
//     before the migration runner is ever queried or invoked.
// (1) fresh `supabase migration list --project-ref <prod> --output-format
//     json` read (read-only) to get Production's REAL current applied vs
//     pending state - never inferred from local file state or a stale
//     hardcoded list;
// (2) [Codex re-review blocker 3] classify the FULL ledger (applied AND
//     pending rows) via classifyFreshLedger - fails closed on a remote-only
//     row, an unexpected applied-state transition (e.g. 20260909 or
//     Lifetime), or any unknown entry, before ever attempting a dry-run;
// (3) build a brand-new isolated directory (buildIsolatedReleaseDirectory)
//     containing only the exact already-applied files (from step 1) plus
//     the 4 allowed package files - the canonical worktree's own
//     supabase/migrations/ is never touched, read-only throughout;
// (4) run `supabase db push --dry-run --project-ref <prod> --workdir
//     <isolated dir> --output-format json` (never applies anything) and
//     compare the exact proposed list via compareDryRunProposal;
// (5) remove the isolated directory in a `finally` block whether the
//     dry-run succeeded or threw.
export function runIsolatedDryRunProof({ prodRef = DEFAULT_PROD_REF, dbUrl = null, sourceMigrationsDir = join(process.cwd(), 'supabase', 'migrations'), scratchRoot = tmpdir() } = {}) {
  const identityFindings = verifyExactFileIdentityAndOrder(sourceMigrationsDir);
  if (identityFindings.length > 0) {
    return { pass: false, findings: identityFindings, stage: 'file-identity' };
  }
  // MIGRATION FILE IDENTITY: PASS

  // dbUrl (optional) targets an arbitrary Postgres connection string instead
  // of --project-ref - used only to exercise this exact function end-to-end
  // against a disposable local database during this remediation's own
  // validation; real release use always passes prodRef (or leaves the
  // Production default), never a connection string.
  const targetArgs = dbUrl ? ['--db-url', dbUrl] : ['--project-ref', prodRef];

  const listOut = execFileSync(
    'npx',
    ['supabase', 'migration', 'list', ...targetArgs, '--output-format', 'json'],
    { encoding: 'utf-8', shell: true },
  );
  const listData = parseMigrationListOutput(listOut);
  const localFiles = localMigrationFiles(sourceMigrationsDir);

  const ledgerFindings = classifyFreshLedger({ migrationListData: listData, localFiles });
  const ledgerErrors = ledgerFindings.filter((f) => f.level === 'error');
  if (ledgerErrors.length > 0) {
    return { pass: false, findings: ledgerFindings, stage: 'remote-ledger-classification' };
  }

  const { appliedVersions } = splitAppliedAndPendingVersions(listData);
  const alreadyAppliedFiles = appliedVersions.map((v) => versionToFilename(v, localFiles));

  return withTempIsolatedDirectory(scratchRoot, (destDir) => {
    buildIsolatedReleaseDirectory({ sourceMigrationsDir, destDir, alreadyAppliedFiles });
    const out = execFileSync(
      'npx',
      ['supabase', 'db', 'push', '--dry-run', ...targetArgs, '--workdir', destDir, '--output-format', 'json'],
      { encoding: 'utf-8', shell: true },
    );
    const dryRunData = parseDryRunOutput(out);
    const comparison = compareDryRunProposal(dryRunData.migrations || []);
    return { ...comparison, stage: 'dry-run', raw: dryRunData, isolatedDir: destDir };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const migrationsDir = join(process.cwd(), 'supabase', 'migrations');

  // 9.3: the CLI entry point calls the SAME complete classifier every other
  // caller uses - no separate, weaker, ad-hoc path. This single call
  // verifies file existence, SHA-256 content match, AND apply order for
  // all 4 required package files in one pass.
  const identityFindings = verifyExactFileIdentityAndOrder(migrationsDir);
  if (identityFindings.length > 0) {
    console.log('MIGRATION FILE IDENTITY: FAIL');
    for (const f of identityFindings) console.log(`[ERROR] ${f.check}: ${f.message}`);
    process.exit(1);
  }
  console.log('MIGRATION FILE IDENTITY: PASS');

  // Zero-network static check: every OTHER local file must be classifiable
  // via the single reviewed baseline (REMOTE_LEDGER_BASELINE - applied,
  // excluded-pending, or this RC's own package; no prefix matching). This
  // does NOT by itself confirm Production's current applied state, nor can
  // it detect a remote-only row or an applied-state transition (both
  // require a live ledger read) - pair with runIsolatedDryRunProof() before
  // any real push.
  const local = localMigrationFiles(migrationsDir);
  const unclassified = local.filter((f) => !(f in REMOTE_LEDGER_BASELINE));

  if (unclassified.length > 0) {
    console.log(`[ERROR] Unclassified local migration file(s) - not in the reviewed ledger baseline (neither the allowed package, a documented exclusion, nor a known-already-applied file): ${unclassified.join(', ')}`);
    process.exit(1);
  }
  console.log('[INFO] Static allowlist + file-identity check: PASS - all 4 package files match their pinned SHA-256, are in the correct order, and every other local migration file is accounted for.');
  console.log('Run runIsolatedDryRunProof() (imported from this module) for the live, read-only, fresh-ledger, isolated-directory --dry-run proof against Production before any real push.');
}
