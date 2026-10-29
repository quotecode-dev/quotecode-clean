// PRODUCT TRUTH — GENERALIZED MARKET DERIVATION (Codex finding 2, 2026-09-24).
//
// Codex found that unknown/unresolved files silently defaulted to "both" markets (a fail-OPEN
// default) and that the only real signal was two hard-coded literal-path Sets (KNOWN_PAIRED_*),
// which does not generalize to any file not already enumerated there by hand.
//
// This module derives market applicability from two GENERIC, source-derived signals, in order,
// and fails CLOSED ('unknown') if neither resolves the file - never a silent 'both':
//   1. File-naming-convention pairing: a file whose name ends in "En" immediately before its
//      extension, where a sibling file with the "En" suffix removed ALSO exists on disk, is the
//      International half of a real, existing pair (the base file is the Local half). Checked with
//      a real fs.existsSync at evaluation time - not a hand-typed list of the 2 pairs known when
//      this was first written, so a FUTURE third pair is picked up automatically.
//   2. Import-graph reachability: for any file not part of such a pair, BFS the real `import ...
//      from '...'` graph starting from the two real app entry points (src/local/AppLocal.jsx,
//      src/global/AppGlobal.jsx). Reachable from both -> 'both' (this is what correctly classifies
//      the many genuinely shared components - Dashboard.jsx, QuoteForm.jsx, SettingsTab.jsx, etc.
//      - which really are mounted by both entry points, not merely assumed to be). Reachable from
//      only one -> that market. Reachable from NEITHER -> 'unknown' (fail closed - this is the
//      behavior change from the old default).
//   3. Supabase Edge Functions are infrastructure with exactly one deployment serving both markets
//      identically (no Local/International function split exists in this codebase) - classified
//      'both' by directory convention, not a per-function special case.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, extname, basename } from 'node:path';

const RESOLVE_EXTENSIONS = ['.jsx', '.js', '.tsx', '.ts'];
const IMPORT_RE = /(?:^|\n)\s*import\s+(?:[^'";]*?\s+from\s+)?['"](\.[^'"]+)['"]/g;

function resolveImportSpecifier(fromFileAbs, specifier, existsFn) {
  const base = join(dirname(fromFileAbs), specifier);
  const candidates = [base, ...RESOLVE_EXTENSIONS.map((ext) => base + ext), ...RESOLVE_EXTENSIONS.map((ext) => join(base, 'index' + ext))];
  for (const c of candidates) {
    if (existsFn(c)) return c;
  }
  return null;
}

function extractImportSpecifiers(text) {
  const specifiers = [];
  const re = new RegExp(IMPORT_RE.source, 'g');
  let m;
  while ((m = re.exec(text)) !== null) specifiers.push(m[1]);
  return specifiers;
}

/**
 * BFS the real import graph starting at `entryAbs`, returning the set of every file (absolute
 * path) transitively imported from it, including the entry itself. Only relative (`./`, `../`)
 * specifiers are followed - bare package imports are not part of this codebase's own module graph.
 * @param {string} entryAbs
 * @param {(p:string) => boolean} existsFn
 * @param {(p:string) => string} readFn
 * @returns {Set<string>}
 */
export function computeReachableSet(entryAbs, existsFn, readFn) {
  const visited = new Set();
  const queue = [entryAbs];
  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    let text;
    try {
      text = readFn(current);
    } catch {
      continue;
    }
    for (const spec of extractImportSpecifiers(text)) {
      const resolved = resolveImportSpecifier(current, spec, existsFn);
      if (resolved && !visited.has(resolved)) queue.push(resolved);
    }
  }
  return visited;
}

/**
 * Generic naming-convention pairing, verified against the real filesystem (never a hand-typed
 * list of already-known pairs).
 * @param {string} fileAbs
 * @param {(p:string) => boolean} existsFn
 * @returns {'local'|'international'|null} null if this file is not part of such a pair
 */
export function classifyByNamingConvention(fileAbs, existsFn) {
  const ext = extname(fileAbs);
  const name = basename(fileAbs, ext);
  const dir = dirname(fileAbs);
  if (name.endsWith('En') && name.length > 2) {
    const baseName = name.slice(0, -2);
    const baseFile = join(dir, baseName + ext);
    if (existsFn(baseFile)) return 'international';
  }
  const enFile = join(dir, name + 'En' + ext);
  if (existsFn(enFile)) return 'local';
  return null;
}

/**
 * Builds a classifier function bound to one computed pair of reachable-sets (computed once, not
 * per file - the two BFS walks are the expensive part).
 * @param {string} baseDir - absolute repo root
 * @param {(p:string) => boolean} [existsFn]
 * @param {(p:string) => string} [readFn]
 * @returns {(relFile: string) => 'local'|'international'|'both'|'unknown'}
 */
export function createFileMarketClassifier(baseDir, existsFn = existsSync, readFn = (p) => readFileSync(p, 'utf-8')) {
  const localEntry = join(baseDir, 'src/local/AppLocal.jsx');
  const intlEntry = join(baseDir, 'src/global/AppGlobal.jsx');
  const localReachable = computeReachableSet(localEntry, existsFn, readFn);
  const intlReachable = computeReachableSet(intlEntry, existsFn, readFn);

  return function classifyFileMarket(relFile) {
    if (relFile.startsWith('supabase/functions/')) return 'both';
    const abs = join(baseDir, relFile);
    const byNaming = classifyByNamingConvention(abs, existsFn);
    if (byNaming) return byNaming;
    const inLocal = localReachable.has(abs);
    const inIntl = intlReachable.has(abs);
    if (inLocal && inIntl) return 'both';
    if (inLocal) return 'local';
    if (inIntl) return 'international';
    return 'unknown';
  };
}

// Codex finding 6 (2026-09-24): the Local market is Hebrew/RTL, the International market is
// English/LTR (confirmed project-wide convention - every *En.<ext> file pairs with an LTR/English
// UI, every base file with an RTL/Hebrew UI). This is a pure, total mapping FROM the already-
// derived market classification - it never re-derives market on its own, so it cannot drift from
// classifyFileMarket's own result.
export function deriveRtlLtrRole(market) {
  if (market === 'local') return 'rtl';
  if (market === 'international') return 'ltr';
  if (market === 'both') return 'both';
  return 'unknown';
}
