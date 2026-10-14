// Task 16 cloud (2026-10-05): verifies every manifest that guards the handoff, the audit evidence and the supplement,
// and reports each KNOWN, documented mismatch separately from unexpected ones (see
// docs/task16-quote-experience-v2/cloud-audit-2026-10-05/MANIFESTS.md). Exit 1 on any unexpected mismatch.
// FAIL-CLOSED (fix 2026-10-05 after Codex proved a false PASS: on a CRLF checkout the old parser split on '\n' only, its
// regex skipped every '\r'-terminated line and nothing required parsed > 0, so all manifests reported "0 OK, 0 unexpected"
// and exited 0). Now:
//   - manifest lines are split on CRLF or LF;
//   - every non-empty line must be a valid `<sha256>  <path>` entry, else MALFORMED (unexpected);
//   - a manifest with zero parsed entries is unexpected (EMPTY);
//   - a missing manifest or listed file is unexpected;
//   - the listed file's EXACT bytes are hashed; a file that matches only after CRLF->LF normalisation is still a mismatch,
//     reported as "DIFFERENT (line endings only - check out with core.autocrlf=false)" so the cause is visible.
// Usage: node scripts/task16/verify-manifests.mjs
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const shaBuf = (b) => createHash('sha256').update(b).digest('hex');
const ENTRY = /^([0-9a-f]{64}) [ *](.+)$/;

export const MANIFESTS = [
  { id: 'M1 transfer (ec29bff)', file: 'docs/task16-quote-experience-v2/cloud-handoff/SHA256SUMS.txt', known: { './CLOUD_HANDOFF.md': 'cloud session appends section 7 (transfer-time bytes: git show ec29bff:...)' } },
  { id: 'M2 audit v1 (6d68ca1)', file: 'docs/task16-quote-experience-v2/cloud-audit-2026-10-05/SHA256SUMS.txt', known: {} },
  { id: 'M3 sources supplement (a4fa58b)', file: 'docs/task16-quote-experience-v2/cloud-handoff/supplement/SHA256SUMS.txt', known: {} },
  { id: 'M5 current', file: 'docs/task16-quote-experience-v2/CURRENT_SHA256SUMS.txt', known: {}, rootRelative: true },
];

// Verifies one manifest; returns { ok, known, bad, parsed, malformed }. `bad` holds every unexpected problem.
export function verifyManifest(root, m) {
  const out = { ok: 0, known: [], bad: [], parsed: 0, malformed: 0 };
  const mf = join(root, m.file);
  if (!existsSync(mf)) { out.bad.push('MISSING manifest'); return out; }
  const base = m.rootRelative ? root : join(root, dirname(m.file));
  const lines = readFileSync(mf, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.trim() === '') return;
    const mm = line.match(ENTRY);
    if (!mm) { out.malformed += 1; out.bad.push(`line ${i + 1}: MALFORMED entry`); return; }
    out.parsed += 1;
    const [, want, rel] = mm;
    const p = join(base, rel);
    if (!existsSync(p)) {
      if (m.known[rel]) out.known.push(`${rel} (${m.known[rel]})`); else out.bad.push(`${rel}: MISSING`);
      return;
    }
    const bytes = readFileSync(p);
    if (shaBuf(bytes) === want) { out.ok += 1; return; }
    if (m.known[rel]) { out.known.push(`${rel} (${m.known[rel]})`); return; }
    const lf = Buffer.from(bytes.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
    out.bad.push(`${rel}: DIFFERENT${shaBuf(lf) === want ? ' (line endings only - check out with core.autocrlf=false)' : ''}`);
  });
  if (out.parsed === 0) out.bad.push('EMPTY manifest (0 parsed entries)');
  return out;
}

export function verifyAll(root, manifests = MANIFESTS, log = console.log) {
  let unexpected = 0;
  for (const m of manifests) {
    const r = verifyManifest(root, m);
    unexpected += r.bad.length;
    log(`${m.id}: ${r.ok} OK, ${r.known.length} known/documented, ${r.bad.length} unexpected (${r.parsed} parsed, ${r.malformed} malformed)`);
    for (const k of r.known) log(`  known: ${k}`);
    for (const b of r.bad) log(`  UNEXPECTED: ${b}`);
  }
  return unexpected;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(verifyAll(process.cwd()) ? 1 : 0);
}
