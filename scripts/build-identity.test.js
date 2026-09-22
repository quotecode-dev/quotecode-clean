import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listBuildInputs, buildInputDigest, sourceIdentity, BUILD_INPUT_ROOTS } from './build-identity.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('build identity (5186 SERVED + LOADED IDENTITY)', () => {
  it('uses the release tooling build-input roots and excludes test files', () => {
    expect(BUILD_INPUT_ROOTS).toEqual(['src', 'public', 'supabase/migrations', 'supabase/functions', 'index.html', 'package.json', 'package-lock.json', 'vite.config.js', '.gitattributes']);
    const files = listBuildInputs(ROOT);
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((f) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f))).toBe(false);
    expect(files).toContain('src/utils/shortDate.js');
  });
  it('digest is a deterministic 64-hex value', () => {
    const a = buildInputDigest(ROOT); const b = buildInputDigest(ROOT);
    expect(a.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toEqual(b);
  });
  it('source identity carries sha, dirtiness and mode', () => {
    const id = sourceIdentity(ROOT, 'localtest');
    expect(id.buildSha).toMatch(/^[0-9a-f]{40}$/);
    expect(typeof id.dirty).toBe('boolean');
    expect(id.mode).toBe('localtest');
  });
});
