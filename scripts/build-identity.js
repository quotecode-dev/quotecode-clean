// IRON-OWNERTEST-001 / 5186 SERVED + LOADED IDENTITY - build-time identity of the application source (Node only; used by vite.config.js).
// The normalized build-input digest is byte-for-byte the SAME algorithm as the release tooling (scripts/release-lib.js
// digestNormalized over BUILD_INPUT_ROOTS, test files excluded, LF-normalized text), so a served/loaded identity can be compared
// with the digest the tooling computes independently from the git objects of the candidate SHA.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const BUILD_INPUT_ROOTS = ['src', 'public', 'supabase/migrations', 'supabase/functions', 'index.html', 'package.json', 'package-lock.json', 'vite.config.js', '.gitattributes'];
const TEST_FILE_RE = /\.(test|spec)\.[cm]?[jt]sx?$/;
const BINARY_EXT_RE = /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|mp4|webm|mov|zip|gz|pdf)$/i;
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

export function git(root, ...args) {
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim(); } catch { return null; }
}

export function listBuildInputs(root) {
  const out = git(root, 'ls-files', '-co', '--exclude-standard', '-z', '--', ...BUILD_INPUT_ROOTS);
  if (out === null) return [];
  return out.split('\0').filter(Boolean).filter((f) => !TEST_FILE_RE.test(f)).filter((f) => existsSync(join(root, f))).sort();
}

export function buildInputDigest(root) {
  const files = listBuildInputs(root);
  const h = createHash('sha256');
  for (const path of files) {
    const bytes = readFileSync(join(root, path));
    const norm = BINARY_EXT_RE.test(path) || bytes.includes(0) ? bytes : Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
    h.update(path).update('\0').update(sha256(norm)).update('\n');
  }
  return { digest: files.length ? h.digest('hex') : 'unknown', fileCount: files.length };
}

// Build-input dirtiness (tracked modifications OR untracked files inside the build-input roots). A local-only untracked file
// OUTSIDE the roots (e.g. vite.gate.config.js) never shapes the served app and is not counted.
export function buildInputsDirty(root) {
  const out = git(root, 'status', '--porcelain', '--untracked-files=all', '--', ...BUILD_INPUT_ROOTS);
  return out === null ? null : out.length > 0;
}

export function sourceIdentity(root, mode) {
  const { digest, fileCount } = buildInputDigest(root);
  return {
    buildSha: git(root, 'rev-parse', 'HEAD') || 'unknown',
    branch: git(root, 'rev-parse', '--abbrev-ref', 'HEAD') || 'unknown',
    worktree: root,
    dirty: buildInputsDirty(root),
    mode,
    buildInputDigest: digest,
    buildInputFileCount: fileCount,
  };
}
