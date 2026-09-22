// PRODUCT TRUTH — SOURCE-OWNED CAPABILITY DISCOVERY (Codex finding 1, 2026-09-24).
//
// Codex found that "component coverage" still depended on a central, hand-typed inventory
// (productTruthComponentAnchors.js's CAPABILITY_ANCHORS object) - a second manually synchronized
// list, not a genuine discovery mechanism: nothing forced it to stay in sync with real source, and
// a human (Claude) was the only thing keeping it accurate.
//
// This module is the structural fix: it walks the REAL filesystem under the given roots and
// extracts every inline, source-owned marker comment - `// PRODUCT_TRUTH_CAPABILITY: <id>` or the
// JSX form `{/* PRODUCT_TRUTH_CAPABILITY: <id> */}` - placed at the actual implementation site by
// a prior, one-time, mechanical edit (see TEKANGO_AI_ARCHITECTURE.md's Product Truth section for
// the exact list of files/lines touched). No list of "files to check" is consulted here - every
// .js/.jsx/.ts/.tsx file under the roots is read from disk and searched. The registry is
// reconciled AGAINST whatever this scan discovers (productTruthComponentCoverage.test.js), not the
// reverse - a marker with no matching registry row, or a registry row with no discoverable marker,
// is exactly the defect class this exists to catch.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, sep } from 'node:path';

// The marker text is built from two literal halves so this file's OWN source text never contains
// the exact contiguous string the scanner searches for - otherwise a self-scan would match this
// module's own regex definition and produce a garbage synthetic "capability". (A belt-and-braces
// path exclusion below also skips this file by name, for the same reason, defense in depth.)
const MARKER_TAG = ['PRODUCT', 'TRUTH_CAPABILITY:'].join('_');
const MARKER_ID_PATTERN = '([a-zA-Z][a-zA-Z0-9_]*)';

const SCAN_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const SKIP_DIR_NAMES = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.vite']);
// This scanner's own file, and the gate-infrastructure/data files that talk ABOUT the convention
// (registry, anchors map kept for the market-evidence/legacy cross-check, gate library) rather
// than being a real implementation site themselves. Every one of the 38 real capabilities is
// implemented in src/components, src/pages, src/utils, src/AIChatWidget.jsx, or supabase/functions
// (chat-ai/send-quote-email/get-public-quote) - never in src/data.
const SKIP_RELATIVE_PATHS = new Set([
  'src/data/productTruthCapabilityScanner.js',
]);
const SKIP_RELATIVE_DIRS = ['src/data/'];

function normalize(relPath) {
  return relPath.split(sep).join('/');
}

function isTestFile(name) {
  return /\.test\.(js|jsx|ts|tsx)$/.test(name);
}

/**
 * Walks every real file under `roots` (paths relative to `baseDir`) and extracts every
 * PRODUCT_TRUTH_CAPABILITY marker actually found in real file content, with its file and
 * 1-indexed line number. Pure filesystem read - no hand-typed file list is consulted.
 * @param {string} baseDir - absolute repository root
 * @param {string[]} roots - directories (relative to baseDir) to scan
 * @returns {{id:string, file:string, line:number}[]}
 */
export function scanCapabilityMarkers(baseDir, roots) {
  const markerRe = new RegExp(`${MARKER_TAG}\\s*${MARKER_ID_PATTERN}`, 'g');
  const found = [];

  const walk = (absDir, relDir) => {
    let entries;
    try {
      entries = readdirSync(absDir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP_DIR_NAMES.has(entry)) continue;
      const absPath = join(absDir, entry);
      const relPath = normalize(relDir ? `${relDir}/${entry}` : entry);
      let st;
      try {
        st = statSync(absPath);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(absPath, relPath);
        continue;
      }
      if (!SCAN_EXTENSIONS.has(extname(entry))) continue;
      if (isTestFile(entry)) continue;
      if (SKIP_RELATIVE_PATHS.has(relPath)) continue;
      if (SKIP_RELATIVE_DIRS.some((d) => relPath.startsWith(d))) continue;

      let text;
      try {
        text = readFileSync(absPath, 'utf-8');
      } catch {
        continue;
      }
      markerRe.lastIndex = 0;
      let m;
      while ((m = markerRe.exec(text)) !== null) {
        const line = text.slice(0, m.index).split('\n').length;
        found.push({ id: m[1], file: relPath, line });
      }
    }
  };

  for (const root of roots) walk(join(baseDir, root), normalize(root));
  return found;
}

/**
 * Groups scanned markers by capability id -> [{file, line}] - the same shape the legacy hand-typed
 * CAPABILITY_ANCHORS map used, so downstream consumers (market-evidence derivation) do not need to
 * change shape, only their SOURCE (a live scan, not an authored object literal).
 * @param {{id:string, file:string, line:number}[]} markers
 * @returns {Record<string, {file:string, line:number}[]>}
 */
export function groupMarkersById(markers) {
  const byId = {};
  for (const m of markers) {
    if (!byId[m.id]) byId[m.id] = [];
    byId[m.id].push({ file: m.file, line: m.line });
  }
  return byId;
}

/**
 * Reconciliation (Codex finding 1's actual gate): compares DISCOVERED markers against the
 * registry, in both directions.
 * @param {Record<string, {file:string, line:number}[]>} discoveredById
 * @param {{id:string, state:string}[]} registryEntries
 * @returns {{discoveredWithNoRegistryRow: string[], liveCurrentWithNoDiscoveredMarker: string[]}}
 */
export function reconcileDiscoveryWithRegistry(discoveredById, registryEntries) {
  const registryById = new Map(registryEntries.map((c) => [c.id, c]));
  const discoveredWithNoRegistryRow = [];
  for (const id of Object.keys(discoveredById)) {
    const entry = registryById.get(id);
    if (!entry || entry.state !== 'LIVE_CURRENT') discoveredWithNoRegistryRow.push(id);
  }
  const liveCurrentWithNoDiscoveredMarker = [];
  for (const c of registryEntries) {
    if (c.state === 'LIVE_CURRENT' && !(discoveredById[c.id] && discoveredById[c.id].length > 0)) {
      liveCurrentWithNoDiscoveredMarker.push(c.id);
    }
  }
  return { discoveredWithNoRegistryRow, liveCurrentWithNoDiscoveredMarker };
}
