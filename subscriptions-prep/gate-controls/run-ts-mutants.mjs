// Isolated orchestrator mutants (TS). Each = ONE textual change in a temporary copy of subscriptions-prep/server/
// authorizeQuoteOutput.ts, run against an unchanged copy of its test file; the intended test must be the FIRST failing test.
//   node subscriptions-prep/gate-controls/run-ts-mutants.mjs --out-dir <evidence dir>
// The temporary copies live in subscriptions-prep/.ts-mutant-tmp (so vitest resolves) and are removed afterwards.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const i = process.argv.indexOf('--out-dir');
const OUT_DIR = i === -1 ? null : path.resolve(process.argv[i + 1]);
if (!OUT_DIR) { console.error('--out-dir <dir> required'); process.exit(2); }
fs.mkdirSync(OUT_DIR, { recursive: true });
const SRC = path.join(ROOT, 'subscriptions-prep', 'server', 'authorizeQuoteOutput.ts');
const TEST = path.join(ROOT, 'subscriptions-prep', 'server', 'authorizeQuoteOutput.prep-test.ts');
const TMP = path.join(ROOT, 'subscriptions-prep', '.ts-mutant-tmp');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const MUTANTS = {
  'no-orphan-cleanup': {
    from: 'if (ABORTING_FINALIZE_CODES.has(code)) await cleanupOwned(p);', to: 'void code;',
    intended: 'customer changed between prepare and finalize: customer_changed_new_quote_required, orphan removed' },
  'existing-object-header-only': {
    from: 'if (!existing || !sameBytes(existing, expected.bytes)) {', to: 'if (!existing || !headerOwnedBy(existing, p)) {',
    intended: 'an existing object with the CORRECT header but different document/issuer/media is snapshot_conflict, not consumed, kept (closure)' },
  'reveal-no-hash-check': {
    from: 'if (!bytes || (await hash(bytes)) !== d.sha256 || bytes.byteLength !== d.bytes) {', to: 'if (!bytes) {',
    intended: 'reveal: FINALIZED with a missing or tampered object is document_unavailable + incident, never regenerated' },
  'reconciler-header-only': {
    from: 'if (!sameBytes(obj, expected.bytes)) { log.push', to: 'if (!headerOwnedBy(obj, bound)) { log.push',
    intended: 'uses the FULL verifier: a correct header with a wrong body/digest is not finalized and not deleted (closure)' },
  'media-not-verified': {
    from: 'if (!obj || obj.byteLength !== m.bytes || (await hash(obj)) !== m.sha256) {', to: 'if (!obj && false) {',
    intended: 'a media hash that does not match the owned object is refused before prepare (media_verification_failed)' },
};
const src = fs.readFileSync(SRC, 'utf8');
const test = fs.readFileSync(TEST, 'utf8').replace("from './authorizeQuoteOutput'", "from './o'");
const verdicts = [];
try {
  for (const [name, m] of Object.entries(MUTANTS)) {
    const n = src.split(m.from).length - 1;
    if (n !== 1) { verdicts.push({ mutant: name, error: `pattern occurrences ${n} (must be exactly 1)` }); continue; }
    const mutant = src.replace(m.from, m.to);
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    fs.writeFileSync(path.join(TMP, 'o.ts'), mutant);
    fs.writeFileSync(path.join(TMP, 't.prep-test.ts'), test);
    const json = path.join(OUT_DIR, `ts-mutant-${name}.vitest.json`);
    const args = ['vitest', 'run', '--config', 'subscriptions-prep/vitest.config.mjs', 'subscriptions-prep/.ts-mutant-tmp', '--reporter=json', `--outputFile=${json}`];
    const r = spawnSync(NPX, args, { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 });
    let rep = null; try { rep = JSON.parse(fs.readFileSync(json, 'utf8')); } catch { /* none */ }
    const results = rep?.testResults?.[0]?.assertionResults ?? [];
    const failed = results.filter((a) => a.status === 'failed');
    const first = failed[0] ?? null;
    const v = {
      mutant: name, mutation: { from: m.from, to: m.to }, originalSha256: sha(src), mutantSha256: sha(mutant), testFileSha256: sha(fs.readFileSync(TEST, 'utf8')),
      command: `npx ${args.join(' ')}`, exit: r.status, tests: results.length, failed: failed.length,
      intendedTest: m.intended, firstFailingTest: first?.title ?? null, firstFailureMessage: first?.failureMessages?.[0]?.split('\n')[0] ?? null,
      collected: results.length > 0,
    };
    v.asIntended = v.exit === 1 && v.collected && v.firstFailingTest === m.intended;
    fs.writeFileSync(path.join(OUT_DIR, `ts-mutant-${name}.verdict.json`), `${JSON.stringify(v, null, 2)}\n`);
    console.log(`TS MUTANT ${name}: ${v.asIntended ? 'CAUGHT first by the intended test' : 'NOT as intended'} (first failing: ${v.firstFailingTest}; failed ${v.failed}/${v.tests})`);
    verdicts.push(v);
  }
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
process.exit(verdicts.every((v) => v.asIntended) ? 0 : 1);
