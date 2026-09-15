import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  classifyFreshLedger,
  REMOTE_LEDGER_BASELINE,
  compareDryRunProposal,
  parseDryRunOutput,
  parseMigrationListOutput,
  splitAppliedAndPendingVersions,
  versionToFilename,
  verifyExactFileIdentityAndOrder,
  buildIsolatedReleaseDirectory,
  withTempIsolatedDirectory,
  runIsolatedDryRunProof,
  computeFileSha256,
  ALLOWED_PRODUCTION_FORWARD_MIGRATIONS,
  EXCLUDED_PENDING_MIGRATIONS,
  LIFETIME_MIGRATION_FILE,
  LIFETIME_MUST_ALREADY_BE_APPLIED_TO_PROD,
  KNOWN_ALREADY_APPLIED_FILES,
} from './check-structured-quote-rc-migration-allowlist.js';

// Structured Quote Production Migration Package Remediation (Codex NO-GO
// blocker 7, 2026-09-15). Every scenario the remediation task's own section
// 9.7 enumerated is covered below, using REAL filesystem fixtures (temp
// directories with real files) and REAL captured CLI output (copied
// verbatim from an actual `supabase db push --dry-run --output-format
// json` / `supabase migration list --output-format json` run against a
// genuine disposable local Postgres during this same remediation - never
// hand-written JSON guesses) wherever the requirement calls for it.

const ALLOWED_NAMES = ALLOWED_PRODUCTION_FORWARD_MIGRATIONS.map((m) => m.file);

let tempDirs = [];
function makeTempDir() {
  const d = mkdtempSync(join(tmpdir(), 'sq-guard-test-'));
  tempDirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of tempDirs) rmSync(d, { recursive: true, force: true });
  tempDirs = [];
});

describe('verifyExactFileIdentityAndOrder - real filesystem checks (9.1, 9.7)', () => {
  function seedRealPackageDir() {
    const dir = makeTempDir();
    for (const { file } of ALLOWED_PRODUCTION_FORWARD_MIGRATIONS) {
      copyFileSync(join(process.cwd(), 'supabase', 'migrations', file), join(dir, file));
    }
    return dir;
  }

  it('PASS: the real, unmodified package files match their pinned hashes and correct order', () => {
    const dir = seedRealPackageDir();
    const findings = verifyExactFileIdentityAndOrder(dir);
    expect(findings).toHaveLength(0);
  });

  it('FAIL: allowed file content modified after review -> hash mismatch', () => {
    const dir = seedRealPackageDir();
    const target = join(dir, ALLOWED_NAMES[0]);
    writeFileSync(target, readFileSync(target, 'utf-8') + '\n-- a sneaky added line\n');
    const findings = verifyExactFileIdentityAndOrder(dir);
    expect(findings.some((f) => f.check === 'package-file-hash-mismatch' && f.message.includes(ALLOWED_NAMES[0]))).toBe(true);
  });

  it('FAIL: allowed file missing from the directory', () => {
    const dir = seedRealPackageDir();
    rmSync(join(dir, ALLOWED_NAMES[2]));
    const findings = verifyExactFileIdentityAndOrder(dir);
    expect(findings.some((f) => f.check === 'package-file-missing' && f.message.includes(ALLOWED_NAMES[2]))).toBe(true);
  });

  // Note: verifyExactFileIdentityAndOrder derives order from a real
  // directory listing sorted by filename - since these 4 filenames' sort
  // order IS their required apply order by construction (identical
  // timestamp prefixes 000000-000003), there is no way to place them out of
  // order on a real filesystem without renaming them away from their own
  // required names (which the hash/missing checks above already catch
  // first). The genuinely independent "wrong order" scenario - an ordering
  // reported by an external source that does not derive from a sorted
  // directory listing - is exercised at the compareDryRunProposal layer
  // below, which consumes the CLI's own reported proposal order.
});

describe('computeFileSha256 - matches a real file (9.1)', () => {
  it('computes the exact pinned hash for the real Part 1 package file on disk', () => {
    const file = join(process.cwd(), 'supabase', 'migrations', ALLOWED_NAMES[0]);
    const hash = computeFileSha256(file);
    expect(hash).toBe(ALLOWED_PRODUCTION_FORWARD_MIGRATIONS[0].sha256);
    expect(hash).toHaveLength(64);
  });
});

describe('classifyFreshLedger - operates on the FULL ledger (applied AND pending), fails closed (Codex re-review blocker 3, section 7/8)', () => {
  const NARROW_APPROVE_FILE = '20260909000000_narrow_public_approve_quote_to_owner_only.sql';
  const ALL_KNOWN_LOCAL_FILES = [
    ...KNOWN_ALREADY_APPLIED_FILES,
    ...Object.keys(EXCLUDED_PENDING_MIGRATIONS),
    ...ALLOWED_NAMES,
  ];

  function versionOf(file) {
    return file.split('_')[0];
  }

  // Builds a realistic `migration list --output-format json` fixture: every
  // file in `appliedFiles` gets a row with `remote` set to its version
  // (matching the real captured shape); every file in `pendingFiles` gets a
  // row with `remote: ''` (also the real captured shape - confirmed empty
  // string, not null, for a not-yet-applied version). `extraRemoteOnlyVersions`
  // simulates a row Production has applied that has NO local file at all.
  function makeLedgerData({ appliedFiles = [], pendingFiles = [], extraRemoteOnlyVersions = [] }) {
    const migrations = [
      ...appliedFiles.map((f) => ({ local: versionOf(f), remote: versionOf(f), time: 'x' })),
      ...pendingFiles.map((f) => ({ local: versionOf(f), remote: '', time: 'x' })),
      ...extraRemoteOnlyVersions.map((v) => ({ local: '', remote: v, time: 'x' })),
    ];
    return { migrations, message: 'Migrations listed' };
  }

  const EXPECTED_LEDGER = () => makeLedgerData({
    appliedFiles: KNOWN_ALREADY_APPLIED_FILES,
    pendingFiles: [...Object.keys(EXCLUDED_PENDING_MIGRATIONS), ...ALLOWED_NAMES],
  });

  it('PASS: exact expected ledger - every known-applied file applied, every excluded/package file pending, nothing else', () => {
    const findings = classifyFreshLedger({ migrationListData: EXPECTED_LEDGER(), localFiles: ALL_KNOWN_LOCAL_FILES });
    expect(findings.filter((f) => f.level === 'error')).toHaveLength(0);
  });

  it('FAIL: a remote-only row (applied on Production, no local file at all)', () => {
    const data = makeLedgerData({
      appliedFiles: KNOWN_ALREADY_APPLIED_FILES,
      pendingFiles: [...Object.keys(EXCLUDED_PENDING_MIGRATIONS), ...ALLOWED_NAMES],
      extraRemoteOnlyVersions: ['20260910000000'],
    });
    const findings = classifyFreshLedger({ migrationListData: data, localFiles: ALL_KNOWN_LOCAL_FILES });
    const errors = findings.filter((f) => f.level === 'error');
    expect(errors.some((e) => e.check === 'remote-only-migration' && e.message.includes('REMOTE-ONLY MIGRATION: FAIL') && e.message.includes('20260910000000'))).toBe(true);
  });

  it('FAIL: an unknown applied migration - a resolvable local file that is not in the reviewed baseline', () => {
    const unknownFile = '20260921000000_unreviewed_change.sql';
    const data = makeLedgerData({
      appliedFiles: [...KNOWN_ALREADY_APPLIED_FILES, unknownFile],
      pendingFiles: [...Object.keys(EXCLUDED_PENDING_MIGRATIONS), ...ALLOWED_NAMES],
    });
    const findings = classifyFreshLedger({ migrationListData: data, localFiles: [...ALL_KNOWN_LOCAL_FILES, unknownFile] });
    const errors = findings.filter((f) => f.level === 'error');
    expect(errors.some((e) => e.check === 'unknown-ledger-entry' && e.message.includes(unknownFile) && e.message.includes('PRODUCTION DELTA CHANGED'))).toBe(true);
  });

  it('FAIL: version 09 (narrow-approve) unexpectedly applied on Production', () => {
    const data = makeLedgerData({
      appliedFiles: [...KNOWN_ALREADY_APPLIED_FILES, NARROW_APPROVE_FILE],
      pendingFiles: [...Object.keys(EXCLUDED_PENDING_MIGRATIONS).filter((f) => f !== NARROW_APPROVE_FILE), ...ALLOWED_NAMES],
    });
    const findings = classifyFreshLedger({ migrationListData: data, localFiles: ALL_KNOWN_LOCAL_FILES });
    const errors = findings.filter((f) => f.level === 'error');
    expect(errors.some((e) => e.check === 'version-09-unexpectedly-applied' && e.message.includes('PRODUCTION DELTA CHANGED'))).toBe(true);
    expect(errors.some((e) => e.check === 'excluded-migration-unexpectedly-applied' && e.message.includes(NARROW_APPROVE_FILE))).toBe(true);
  });

  it('FAIL: Lifetime unexpectedly pending (changed state from applied)', () => {
    const data = makeLedgerData({
      appliedFiles: KNOWN_ALREADY_APPLIED_FILES.filter((f) => f !== LIFETIME_MIGRATION_FILE),
      pendingFiles: [LIFETIME_MIGRATION_FILE, ...Object.keys(EXCLUDED_PENDING_MIGRATIONS), ...ALLOWED_NAMES],
    });
    const findings = classifyFreshLedger({ migrationListData: data, localFiles: ALL_KNOWN_LOCAL_FILES });
    const errors = findings.filter((f) => f.level === 'error');
    expect(errors.some((e) => e.check === 'lifetime-state-unchanged')).toBe(true);
    expect(errors.some((e) => e.check === 'applied-state-regression' && e.message.includes(LIFETIME_MIGRATION_FILE))).toBe(true);
  });

  it('FAIL: one of the 4 package files missing from the fresh ledger entirely', () => {
    const data = makeLedgerData({
      appliedFiles: KNOWN_ALREADY_APPLIED_FILES,
      pendingFiles: [...Object.keys(EXCLUDED_PENDING_MIGRATIONS), ...ALLOWED_NAMES.slice(0, 3)],
    });
    const findings = classifyFreshLedger({ migrationListData: data, localFiles: ALL_KNOWN_LOCAL_FILES });
    const errors = findings.filter((f) => f.level === 'error');
    expect(errors.some((e) => e.check === 'package-files-present' && e.message.includes(ALLOWED_NAMES[3]))).toBe(true);
  });

  it('FAIL: a package file already applied to Production outside this push', () => {
    const data = makeLedgerData({
      appliedFiles: [...KNOWN_ALREADY_APPLIED_FILES, ALLOWED_NAMES[0]],
      pendingFiles: [...Object.keys(EXCLUDED_PENDING_MIGRATIONS), ...ALLOWED_NAMES.slice(1)],
    });
    const findings = classifyFreshLedger({ migrationListData: data, localFiles: ALL_KNOWN_LOCAL_FILES });
    const errors = findings.filter((f) => f.level === 'error');
    expect(errors.some((e) => e.check === 'package-file-already-applied' && e.message.includes(ALLOWED_NAMES[0]))).toBe(true);
  });

  it('FAIL: an applied-to-Production file unexpectedly reported as pending (regression on a pre-908 already-applied file)', () => {
    const data = makeLedgerData({
      appliedFiles: KNOWN_ALREADY_APPLIED_FILES.filter((f) => f !== '20260828000000_add_quote_attn_contact.sql'),
      pendingFiles: ['20260828000000_add_quote_attn_contact.sql', ...Object.keys(EXCLUDED_PENDING_MIGRATIONS), ...ALLOWED_NAMES],
    });
    const findings = classifyFreshLedger({ migrationListData: data, localFiles: ALL_KNOWN_LOCAL_FILES });
    const errors = findings.filter((f) => f.level === 'error');
    expect(errors.some((e) => e.check === 'applied-state-regression' && e.message.includes('20260828000000_add_quote_attn_contact.sql'))).toBe(true);
  });

  it('FAIL: a ledger row names a version with no matching local file at all (unresolvable)', () => {
    const data = makeLedgerData({
      appliedFiles: KNOWN_ALREADY_APPLIED_FILES,
      pendingFiles: [...Object.keys(EXCLUDED_PENDING_MIGRATIONS), ...ALLOWED_NAMES],
    });
    // localFiles deliberately excludes one of the pending package files, so
    // its version cannot resolve even though the ledger lists it.
    const trimmedLocalFiles = ALL_KNOWN_LOCAL_FILES.filter((f) => f !== ALLOWED_NAMES[0]);
    const findings = classifyFreshLedger({ migrationListData: data, localFiles: trimmedLocalFiles });
    const errors = findings.filter((f) => f.level === 'error');
    expect(errors.some((e) => e.check === 'unresolvable-ledger-version' && e.message.includes('PRODUCTION DELTA CHANGED'))).toBe(true);
  });

  it('FAIL: version 09 (narrow-approve) missing entirely from the fresh ledger', () => {
    const data = makeLedgerData({
      appliedFiles: KNOWN_ALREADY_APPLIED_FILES,
      pendingFiles: [...Object.keys(EXCLUDED_PENDING_MIGRATIONS).filter((f) => f !== NARROW_APPROVE_FILE), ...ALLOWED_NAMES],
    });
    const findings = classifyFreshLedger({ migrationListData: data, localFiles: ALL_KNOWN_LOCAL_FILES });
    const errors = findings.filter((f) => f.level === 'error');
    expect(errors.some((e) => e.check === 'version-09-missing' && e.message.includes('PRODUCTION DELTA CHANGED'))).toBe(true);
  });

  it('FAIL: Lifetime missing entirely from the fresh ledger', () => {
    const data = makeLedgerData({
      appliedFiles: KNOWN_ALREADY_APPLIED_FILES.filter((f) => f !== LIFETIME_MIGRATION_FILE),
      pendingFiles: [...Object.keys(EXCLUDED_PENDING_MIGRATIONS), ...ALLOWED_NAMES],
    });
    const findings = classifyFreshLedger({ migrationListData: data, localFiles: ALL_KNOWN_LOCAL_FILES });
    const errors = findings.filter((f) => f.level === 'error');
    expect(errors.some((e) => e.check === 'lifetime-state-unchanged' && e.message.includes('missing entirely'))).toBe(true);
  });

  it('FAIL: a known expected-applied baseline migration missing entirely from the fresh ledger', () => {
    const missingFile = '20260828000000_add_quote_attn_contact.sql';
    const data = makeLedgerData({
      appliedFiles: KNOWN_ALREADY_APPLIED_FILES.filter((f) => f !== missingFile),
      pendingFiles: [...Object.keys(EXCLUDED_PENDING_MIGRATIONS), ...ALLOWED_NAMES],
    });
    const findings = classifyFreshLedger({ migrationListData: data, localFiles: ALL_KNOWN_LOCAL_FILES });
    const errors = findings.filter((f) => f.level === 'error');
    expect(errors.some((e) => e.check === 'baseline-entry-missing' && e.message.includes(missingFile))).toBe(true);
  });

  it('FAIL: a known expected-pending-excluded baseline migration missing entirely from the fresh ledger', () => {
    const missingFile = '20260830000000_capture_base_schema_tables.sql';
    const data = makeLedgerData({
      appliedFiles: KNOWN_ALREADY_APPLIED_FILES,
      pendingFiles: [...Object.keys(EXCLUDED_PENDING_MIGRATIONS).filter((f) => f !== missingFile), ...ALLOWED_NAMES],
    });
    const findings = classifyFreshLedger({ migrationListData: data, localFiles: ALL_KNOWN_LOCAL_FILES });
    const errors = findings.filter((f) => f.level === 'error');
    expect(errors.some((e) => e.check === 'baseline-entry-missing' && e.message.includes(missingFile))).toBe(true);
  });

  it('PASS: a superseded-by-package excluded file (e.g. the old TEST-history 20260902 file) missing entirely from the ledger does NOT fail baseline completeness', () => {
    const supersededFile = '20260902000000_add_professional_quote_items_stage_a.sql';
    const data = makeLedgerData({
      appliedFiles: KNOWN_ALREADY_APPLIED_FILES,
      pendingFiles: [...Object.keys(EXCLUDED_PENDING_MIGRATIONS).filter((f) => f !== supersededFile), ...ALLOWED_NAMES],
    });
    const findings = classifyFreshLedger({ migrationListData: data, localFiles: ALL_KNOWN_LOCAL_FILES.filter((f) => f !== supersededFile) });
    const errors = findings.filter((f) => f.level === 'error');
    expect(errors.some((e) => e.message.includes(supersededFile))).toBe(false);
  });

  it('FAIL: a baseline migration appears twice in the fresh ledger (duplicate row)', () => {
    const data = EXPECTED_LEDGER();
    data.migrations.push({ local: versionOf(ALLOWED_NAMES[0]), remote: '', time: 'x' });
    const findings = classifyFreshLedger({ migrationListData: data, localFiles: ALL_KNOWN_LOCAL_FILES });
    const errors = findings.filter((f) => f.level === 'error');
    expect(errors.some((e) => e.check === 'duplicate-ledger-row' && e.message.includes(ALLOWED_NAMES[0]))).toBe(true);
  });

  it('FAIL: a malformed row with neither local nor remote is not silently skipped', () => {
    const data = EXPECTED_LEDGER();
    data.migrations.push({ time: 'x' });
    const findings = classifyFreshLedger({ migrationListData: data, localFiles: ALL_KNOWN_LOCAL_FILES });
    const errors = findings.filter((f) => f.level === 'error');
    expect(errors.some((e) => e.check === 'malformed-ledger-row')).toBe(true);
  });

  it('FAIL: a malformed row with a non-string/invalid version value', () => {
    const data = EXPECTED_LEDGER();
    data.migrations.push({ local: 20260917000000, remote: '', time: 'x' });
    const findings = classifyFreshLedger({ migrationListData: data, localFiles: ALL_KNOWN_LOCAL_FILES });
    const errors = findings.filter((f) => f.level === 'error');
    expect(errors.some((e) => e.check === 'malformed-ledger-row')).toBe(true);
  });

  it('FAIL: a malformed row that is not an object at all', () => {
    const data = EXPECTED_LEDGER();
    data.migrations.push('not-a-row');
    const findings = classifyFreshLedger({ migrationListData: data, localFiles: ALL_KNOWN_LOCAL_FILES });
    const errors = findings.filter((f) => f.level === 'error');
    expect(errors.some((e) => e.check === 'malformed-ledger-row')).toBe(true);
  });

  it('REMOTE_LEDGER_BASELINE is a single source of truth derived from the other exported constants - no separate hand-maintained list', () => {
    for (const f of KNOWN_ALREADY_APPLIED_FILES) expect(REMOTE_LEDGER_BASELINE[f]).toBe('applied');
    for (const f of Object.keys(EXCLUDED_PENDING_MIGRATIONS)) expect(REMOTE_LEDGER_BASELINE[f]).toBe('pending-excluded');
    for (const f of ALLOWED_NAMES) expect(REMOTE_LEDGER_BASELINE[f]).toBe('pending-package');
  });
});

describe('runIsolatedDryRunProof - pinned file identity gates EVERY execution path, before any network call (Codex re-review blocker 2)', () => {
  // These are genuinely safe to run offline: verifyExactFileIdentityAndOrder
  // fails and the function returns BEFORE its first execFileSync call (the
  // fresh `migration list` read) is ever reached - no network attempted, no
  // CLI invoked, confirmed by the fact these tests pass with zero network
  // access and complete in milliseconds, not the seconds a real CLI call
  // would take.
  function seedRealPackageDir() {
    const dir = makeTempDir();
    for (const { file } of ALLOWED_PRODUCTION_FORWARD_MIGRATIONS) {
      copyFileSync(join(process.cwd(), 'supabase', 'migrations', file), join(dir, file));
    }
    return dir;
  }

  it('FAIL before dry-run: altered allowed SQL content stops at the file-identity stage', () => {
    const dir = seedRealPackageDir();
    writeFileSync(join(dir, ALLOWED_NAMES[3]), readFileSync(join(dir, ALLOWED_NAMES[3]), 'utf-8') + '\n-- tampered\n');
    const result = runIsolatedDryRunProof({ sourceMigrationsDir: dir });
    expect(result.pass).toBe(false);
    expect(result.stage).toBe('file-identity');
    expect(result.findings.some((f) => f.check === 'package-file-hash-mismatch')).toBe(true);
  });

  it('FAIL before dry-run: one required migration file missing stops at the file-identity stage', () => {
    const dir = seedRealPackageDir();
    rmSync(join(dir, ALLOWED_NAMES[1]));
    const result = runIsolatedDryRunProof({ sourceMigrationsDir: dir });
    expect(result.pass).toBe(false);
    expect(result.stage).toBe('file-identity');
    expect(result.findings.some((f) => f.check === 'package-file-missing' && f.message.includes(ALLOWED_NAMES[1]))).toBe(true);
  });

  it('PASS path exists: the real, unmodified package would clear the file-identity gate (does not itself attempt the network call in this test)', () => {
    const dir = seedRealPackageDir();
    const identityFindings = verifyExactFileIdentityAndOrder(dir);
    expect(identityFindings).toHaveLength(0);
  });
});

describe('compareDryRunProposal - the actual dry-run candidate set must be exact (9.6, 9.7)', () => {
  it('PASS: exact 4-file match, correct order', () => {
    const result = compareDryRunProposal([...ALLOWED_NAMES]);
    expect(result.pass).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it('FAIL: Lifetime present in the candidate set', () => {
    const result = compareDryRunProposal([LIFETIME_MIGRATION_FILE, ...ALLOWED_NAMES]);
    expect(result.pass).toBe(false);
    expect(result.findings.some((f) => f.check === 'dangerous-migration-in-candidate-set' && f.message.includes(LIFETIME_MIGRATION_FILE))).toBe(true);
  });

  it('FAIL: 20260909 present in the candidate set', () => {
    const result = compareDryRunProposal([...ALLOWED_NAMES, '20260909000000_narrow_public_approve_quote_to_owner_only.sql']);
    expect(result.pass).toBe(false);
    expect(result.findings.some((f) => f.check === 'dangerous-migration-in-candidate-set' && f.message.includes('20260909'))).toBe(true);
  });

  it('FAIL: an unexpected extra pending file (not dangerous, just unknown) in the candidate set', () => {
    const result = compareDryRunProposal([...ALLOWED_NAMES, '20260920000000_some_unrelated_change.sql']);
    expect(result.pass).toBe(false);
    expect(result.findings.some((f) => f.check === 'unexpected-migration-in-candidate-set')).toBe(true);
  });

  it('FAIL: the candidate set is missing one of the 4 required files', () => {
    const result = compareDryRunProposal(ALLOWED_NAMES.slice(0, 3));
    expect(result.pass).toBe(false);
    expect(result.findings.some((f) => f.check === 'package-incomplete-in-candidate-set')).toBe(true);
  });

  it('FAIL: exactly the right 4 files but in the WRONG ORDER', () => {
    const shuffled = [ALLOWED_NAMES[1], ALLOWED_NAMES[0], ALLOWED_NAMES[3], ALLOWED_NAMES[2]];
    const result = compareDryRunProposal(shuffled);
    expect(result.pass).toBe(false);
    expect(result.findings.some((f) => f.check === 'candidate-set-wrong-order')).toBe(true);
  });
});

describe('parseDryRunOutput / parseMigrationListOutput - real captured CLI output, not blind brace-scanning (9.6)', () => {
  // Captured verbatim (message text unchanged) from a REAL
  // `npx supabase db push --dry-run --project-ref <disposable-local-db>
  // --output-format json` run during this remediation's own disposable
  // validation (2026-09-15) - proves the actual shape: human-readable
  // progress lines first, JSON result object as the LAST non-empty line.
  const REAL_CAPTURED_DRY_RUN_OUTPUT = [
    'DRY RUN: migrations will *not* be pushed to the database.',
    'Connecting to local database...',
    'Would push these migrations:',
    ' • 20260917000000_prod_forward_professional_quote_items_stage_a.sql',
    ' • 20260917000001_prod_forward_business_professional_domain.sql',
    ' • 20260917000002_prod_forward_professional_quote_hierarchy.sql',
    ' • 20260917000003_prod_forward_save_quote_structured_atomic_function.sql',
    '{"upToDate":false,"dryRun":true,"migrations":["20260917000000_prod_forward_professional_quote_items_stage_a.sql","20260917000001_prod_forward_business_professional_domain.sql","20260917000002_prod_forward_professional_quote_hierarchy.sql","20260917000003_prod_forward_save_quote_structured_atomic_function.sql"],"seeds":[],"roles":[],"message":"Finished supabase db push."}',
  ].join('\n');

  const REAL_CAPTURED_UP_TO_DATE_OUTPUT = [
    'DRY RUN: migrations will *not* be pushed to the database.',
    'Connecting to local database...',
    '{"upToDate":true,"dryRun":true,"migrations":[],"seeds":[],"roles":[],"message":"Local database is up to date."}',
  ].join('\n');

  const REAL_CAPTURED_MIGRATION_LIST_OUTPUT = [
    'Connecting to local database...',
    '{"migrations":[{"local":"20260830000000","remote":"20260830000000","time":"2026-08-30 00:00:00"},{"local":"20260917000000","remote":"","time":"2026-09-17 00:00:00"}],"message":"Migrations listed"}',
  ].join('\n');

  it('parses the real captured dry-run output, extracting exactly the 4 proposed migrations', () => {
    const data = parseDryRunOutput(REAL_CAPTURED_DRY_RUN_OUTPUT);
    expect(data.migrations).toEqual(ALLOWED_NAMES);
    expect(data.upToDate).toBe(false);
  });

  it('parses the real captured "up to date" (nothing pending) shape', () => {
    const data = parseDryRunOutput(REAL_CAPTURED_UP_TO_DATE_OUTPUT);
    expect(data.migrations).toEqual([]);
    expect(data.upToDate).toBe(true);
  });

  it('does NOT blindly scan for the first "{" - a human-readable line preceding the JSON is ignored even if malformed/brace-like', () => {
    const withNoise = 'note: {this looks like json but isn\'t}\n' + REAL_CAPTURED_DRY_RUN_OUTPUT;
    const data = parseDryRunOutput(withNoise);
    expect(data.migrations).toEqual(ALLOWED_NAMES);
  });

  it('throws a clear error when the last line is not valid JSON (CLI output-format shape changed)', () => {
    expect(() => parseDryRunOutput('Would push these migrations:\n • some_file.sql')).toThrow(/not valid JSON/);
  });

  it('throws a clear error on empty output', () => {
    expect(() => parseDryRunOutput('')).toThrow(/Empty dry-run output/);
  });

  it('throws a clear error when the last line IS valid JSON but missing the expected "migrations" field (malformed dry-run output)', () => {
    expect(() => parseDryRunOutput('Connecting to remote database...\n{"ok":true,"message":"unexpected shape"}')).toThrow(/missing the expected "migrations" array field/);
  });

  it('throws a clear error when migration-list output is valid JSON but missing "migrations" (malformed)', () => {
    expect(() => parseMigrationListOutput('Connecting...\n{"message":"nothing here"}')).toThrow(/missing the expected "migrations" array field/);
  });

  it('throws a clear error when "migrations" is present but not an array', () => {
    expect(() => parseMigrationListOutput('Connecting...\n{"migrations":"not-an-array","message":"x"}')).toThrow(/missing the expected "migrations" array field/);
    expect(() => parseDryRunOutput('{"migrations":{"not":"an array"},"message":"x"}')).toThrow(/missing the expected "migrations" array field/);
  });

  it('throws a clear error when migration-list output\'s last line is not valid JSON', () => {
    expect(() => parseMigrationListOutput('Connecting...\nnot json at all')).toThrow(/not valid JSON/);
  });

  it('parses the real captured migration-list output', () => {
    const data = parseMigrationListOutput(REAL_CAPTURED_MIGRATION_LIST_OUTPUT);
    expect(data.migrations).toHaveLength(2);
    expect(data.migrations[0]).toEqual({ local: '20260830000000', remote: '20260830000000', time: '2026-08-30 00:00:00' });
  });
});

describe('splitAppliedAndPendingVersions + versionToFilename (9.2 - exact version match, not a fuzzy prefix)', () => {
  it('splits real captured entries into applied (remote set) vs pending (remote empty string)', () => {
    const data = {
      migrations: [
        { local: '20260830000000', remote: '20260830000000', time: 'x' },
        { local: '20260917000000', remote: '', time: 'x' },
      ],
    };
    const { appliedVersions, pendingVersions } = splitAppliedAndPendingVersions(data);
    expect(appliedVersions).toEqual(['20260830000000']);
    expect(pendingVersions).toEqual(['20260917000000']);
  });

  it('resolves a version to its exact local filename', () => {
    const localFiles = ['20260917000000_prod_forward_professional_quote_items_stage_a.sql', '20260917000001_prod_forward_business_professional_domain.sql'];
    expect(versionToFilename('20260917000000', localFiles)).toBe(localFiles[0]);
  });

  it('does not falsely match a version that is only a short prefix of another (unlike startsWith on a short date prefix)', () => {
    const localFiles = ['20260827000000_add_quote_number_sequence.sql', '202608270000015_attach_quote_number_unique_constraint.sql'];
    // '20260827000000' must resolve to the first file, never accidentally
    // matching the second (which shares the same leading digits but is a
    // DIFFERENT, longer, distinct version string).
    expect(versionToFilename('20260827000000', localFiles)).toBe(localFiles[0]);
  });

  it('throws PRODUCTION DELTA CHANGED when the ledger names a version with no matching local file', () => {
    expect(() => versionToFilename('99999999999999', ['20260917000000_x.sql'])).toThrow(/PRODUCTION DELTA CHANGED/);
  });
});

describe('buildIsolatedReleaseDirectory - real filesystem, source directory never mutated (9.5)', () => {
  it('copies exactly the requested files into a NEW directory and leaves the source untouched', () => {
    const sourceMigrationsDir = join(process.cwd(), 'supabase', 'migrations');
    const before = readFileSync(join(sourceMigrationsDir, ALLOWED_NAMES[0]), 'utf-8');
    const destDir = makeTempDir();
    const alreadyAppliedFiles = ['20260830000000_capture_base_schema_tables.sql'];

    const result = buildIsolatedReleaseDirectory({ sourceMigrationsDir, destDir, alreadyAppliedFiles });

    expect(result.copied).toEqual([...alreadyAppliedFiles, ...ALLOWED_NAMES]);
    for (const f of result.copied) {
      expect(existsSync(join(result.destMigrationsDir, f))).toBe(true);
    }
    // Source untouched.
    expect(readFileSync(join(sourceMigrationsDir, ALLOWED_NAMES[0]), 'utf-8')).toBe(before);
    expect(existsSync(join(sourceMigrationsDir, '_rc_excluded_temp'))).toBe(false);
  });

  it('throws when a required already-applied file is missing from the source, without leaving a partial copy silently treated as success', () => {
    const sourceMigrationsDir = join(process.cwd(), 'supabase', 'migrations');
    const destDir = makeTempDir();
    expect(() => buildIsolatedReleaseDirectory({
      sourceMigrationsDir,
      destDir,
      alreadyAppliedFiles: ['20260827000000_add_quote_number_sequence.sql', '99999999999999_does_not_exist.sql'],
    })).toThrow(/required file missing from source/);
  });
});

describe('withTempIsolatedDirectory - cleanup on failure (9.5, 9.7)', () => {
  it('removes the temp directory after fn completes successfully', () => {
    let capturedDir;
    const result = withTempIsolatedDirectory(tmpdir(), (dir) => {
      capturedDir = dir;
      expect(existsSync(dir)).toBe(true);
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(existsSync(capturedDir)).toBe(false);
  });

  it('still removes the temp directory when fn throws, and the error still propagates', () => {
    let capturedDir;
    expect(() => withTempIsolatedDirectory(tmpdir(), (dir) => {
      capturedDir = dir;
      writeFileSync(join(dir, 'partial.txt'), 'x'); // simulate partial work before the failure
      throw new Error('simulated dry-run CLI failure');
    })).toThrow('simulated dry-run CLI failure');
    expect(existsSync(capturedDir)).toBe(false);
  });
});

describe('allowlist/exclusion sets do not overlap and cover the reviewed file set exactly', () => {
  it('no filename is both allowed and excluded', () => {
    const overlap = ALLOWED_NAMES.filter((f) => f in EXCLUDED_PENDING_MIGRATIONS);
    expect(overlap).toHaveLength(0);
  });

  it('every excluded file carries a non-empty documented reason', () => {
    for (const reason of Object.values(EXCLUDED_PENDING_MIGRATIONS)) {
      expect(typeof reason).toBe('string');
      expect(reason.length).toBeGreaterThan(10);
    }
  });

  it('the allowlist is exactly 4 files, each with a 64-char hex SHA-256 pinned', () => {
    expect(ALLOWED_PRODUCTION_FORWARD_MIGRATIONS).toHaveLength(4);
    for (const m of ALLOWED_PRODUCTION_FORWARD_MIGRATIONS) {
      expect(m.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('KNOWN_ALREADY_APPLIED_FILES is an exact filename list, not a prefix pattern (9.2)', () => {
    for (const f of KNOWN_ALREADY_APPLIED_FILES) {
      expect(f.endsWith('.sql')).toBe(true);
      expect(f).not.toMatch(/\*/);
    }
  });
});
