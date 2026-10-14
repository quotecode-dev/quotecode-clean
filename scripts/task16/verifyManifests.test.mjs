// @vitest-environment node
// Task 16 cloud (2026-10-05): fail-closed tests for scripts/task16/verify-manifests.mjs. Negative controls for the false PASS
// Codex proved on a CRLF checkout (old parser: 0 OK / 0 unexpected / exit 0) plus empty, malformed, missing and changed files.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyManifest, verifyAll } from './verify-manifests.mjs';

const sha = (s) => createHash('sha256').update(s).digest('hex');
let root;
const M = { id: 'T', file: 'm/SHA256SUMS.txt', known: {} };
const put = (rel, body) => { const p = join(root, rel); mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, body); };

beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'vm-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

describe('verify-manifests is fail-closed', () => {
  it('LF manifest and LF files: every entry OK', () => {
    put('m/a.txt', 'alpha\n'); put('m/b.txt', 'beta\n');
    put('m/SHA256SUMS.txt', `${sha('alpha\n')}  ./a.txt\n${sha('beta\n')}  ./b.txt\n`);
    const r = verifyManifest(root, M);
    expect(r).toMatchObject({ ok: 2, parsed: 2, malformed: 0 });
    expect(r.bad).toEqual([]);
  });

  it('CRLF manifest is still parsed (the old parser skipped every line and passed with 0 entries)', () => {
    put('m/a.txt', 'alpha\n');
    put('m/SHA256SUMS.txt', `${sha('alpha\n')}  ./a.txt\r\n`);
    const r = verifyManifest(root, M);
    expect(r.parsed).toBe(1);
    expect(r.ok).toBe(1);
    expect(r.bad).toEqual([]);
  });

  it('CRLF checkout of LF-hashed files FAILS and names the line-ending cause (no silent normalisation)', () => {
    put('m/a.txt', 'alpha\r\nmore\r\n');
    put('m/SHA256SUMS.txt', `${sha('alpha\nmore\n')}  ./a.txt\r\n`);
    const r = verifyManifest(root, M);
    expect(r.ok).toBe(0);
    expect(r.bad).toEqual(['./a.txt: DIFFERENT (line endings only - check out with core.autocrlf=false)']);
  });

  it('empty manifest FAILS', () => {
    put('m/SHA256SUMS.txt', '\r\n\n');
    expect(verifyManifest(root, M).bad).toContain('EMPTY manifest (0 parsed entries)');
  });

  it('malformed line FAILS (it is not skipped)', () => {
    put('m/a.txt', 'alpha\n');
    put('m/SHA256SUMS.txt', `${sha('alpha\n')}  ./a.txt\nnot-a-hash  ./b.txt\n`);
    const r = verifyManifest(root, M);
    expect(r.malformed).toBe(1);
    expect(r.bad).toEqual(['line 2: MALFORMED entry']);
  });

  it('missing manifest, missing file and a changed byte all FAIL; verifyAll returns their count', () => {
    put('m/a.txt', 'alphA\n');
    put('m/SHA256SUMS.txt', `${sha('alpha\n')}  ./a.txt\n${sha('gone\n')}  ./gone.txt\n`);
    const logs = [];
    const n = verifyAll(root, [M, { id: 'X', file: 'nope/SHA256SUMS.txt', known: {} }], (l) => logs.push(l));
    expect(n).toBe(3);
    expect(logs.join('\n')).toMatch(/\.\/a\.txt: DIFFERENT$/m);
    expect(logs.join('\n')).toMatch(/\.\/gone\.txt: MISSING/);
    expect(logs.join('\n')).toMatch(/MISSING manifest/);
  });

  it('a documented known mismatch is reported separately and does not count as unexpected', () => {
    put('m/a.txt', 'edited\n');
    put('m/SHA256SUMS.txt', `${sha('original\n')}  ./a.txt\n`);
    const r = verifyManifest(root, { ...M, known: { './a.txt': 'documented' } });
    expect(r.known).toHaveLength(1);
    expect(r.bad).toEqual([]);
  });
});
