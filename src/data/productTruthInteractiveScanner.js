// PRODUCT TRUTH — ENFORCEABLE SOURCE INVENTORY (Codex "enforceable source inventory" finding,
// 2026-09-2X). Closes the gap the marker-only scanner (productTruthCapabilityScanner.js) cannot
// close by itself: a scan for markers can only ever prove facts about markers that were placed -
// it structurally cannot detect the ABSENCE of a marker on a brand-new interactive control, because
// there is nothing there to find. This module supplies the missing, real signal: a mechanical count
// of interactive controls (<button>, <Link>, role="button", <a href=) per file, compared against a
// committed BASELINE snapshot captured once from real source (scripts/generate-product-truth-
// interactive-baseline.js) - never hand-typed. A file's real interactive-vs-marker GAP growing
// beyond its recorded baseline gap is exactly "a visible capability was added without a marker",
// caught by counting, not by guessing at intent.
//
// Owner decision (2026-09-2X, in response to the real numbers: 175 interactive elements against 48
// markers across the 21 real capability-bearing files today): a BASELINE-SNAPSHOT gate, not a full
// immediate retrofit. Retrofitting every pre-existing decorative sub-control (calculator digit
// keys, menu items, close buttons - the great majority of the 127-element gap) with an exemption
// comment would touch ~127 lines across 21 files, including ~22 in QuoteForm.jsx (Smart Quote) and
// ~14 in Dashboard.jsx alone - out of proportion to this task's locked "no scope expansion, do not
// touch Smart Quote UX" boundary, and no more informative than accepting today's real count as the
// starting point. The baseline is regenerated only by deliberately re-running the generator script,
// which makes any future increase in an accepted gap a visible, reviewable diff - never a silent
// drift back to "we don't actually know".
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const INTERACTIVE_ELEMENT_RE = /<button\b|<Link\b|role=["']button["']|<a\s+[^>]*href=/g;
const CAPABILITY_MARKER_RE = /PRODUCT_TRUTH_CAPABILITY:\s*[a-zA-Z][a-zA-Z0-9_]*/g;
// A reviewed, explicit exemption for a real interactive control that is decorative / not its own
// distinct Product Truth capability (e.g. a modal close button, a calculator digit key already
// covered by its capability's own marker elsewhere in the same file). Free-text reason after the
// colon - never parsed for meaning, only counted as "a human looked at this and exempted it".
const DECORATIVE_MARKER_RE = /PRODUCT_TRUTH_DECORATIVE:\s*\S+/g;

/**
 * @param {string} text
 * @returns {{interactive:number, capabilityMarkers:number, decorativeMarkers:number, markers:number}}
 */
export function countInteractiveSurface(text) {
  const src = typeof text === 'string' ? text : '';
  const interactive = (src.match(INTERACTIVE_ELEMENT_RE) || []).length;
  const capabilityMarkers = (src.match(CAPABILITY_MARKER_RE) || []).length;
  const decorativeMarkers = (src.match(DECORATIVE_MARKER_RE) || []).length;
  return { interactive, capabilityMarkers, decorativeMarkers, markers: capabilityMarkers + decorativeMarkers };
}

/**
 * @param {string} baseDir
 * @param {string[]} files - relative paths to scan (the capability-bearing file universe, from
 *   productTruthCapabilityScanner.js's listScannableFiles - never a second hand-typed file list)
 * @param {(rel:string)=>boolean} [existsFn]
 * @param {(rel:string)=>string} [readFn]
 * @returns {Record<string, {interactive:number, capabilityMarkers:number, decorativeMarkers:number, markers:number}>}
 */
export function scanInteractiveSurface(baseDir, files, existsFn = (rel) => existsSync(join(baseDir, rel)), readFn = (rel) => readFileSync(join(baseDir, rel), 'utf-8')) {
  const result = {};
  for (const rel of files) {
    if (!existsFn(rel)) continue;
    result[rel] = countInteractiveSurface(readFn(rel));
  }
  return result;
}

/**
 * Compares a fresh scan against the committed baseline. A file absent from the baseline is treated
 * as a brand-new file with an implicit baseline of zero interactive elements and zero markers - so
 * ANY unmarked interactive element in a genuinely new file fails immediately; there is no free pass
 * for new files merely because the baseline predates them.
 * @param {Record<string, {interactive:number, markers:number}>} current
 * @param {Record<string, {interactive:number, markers:number}>} baseline
 * @returns {{file:string, reason:'regression'|'new_file_unmarked', currentGap:number, baselineGap:number}[]}
 */
export function checkInteractiveCompleteness(current, baseline) {
  const failures = [];
  for (const [file, stats] of Object.entries(current)) {
    const hasBaseline = Object.prototype.hasOwnProperty.call(baseline, file);
    const base = hasBaseline ? baseline[file] : { interactive: 0, markers: 0 };
    const currentGap = stats.interactive - stats.markers;
    const baselineGap = base.interactive - base.markers;
    if (currentGap > baselineGap) {
      failures.push({ file, reason: hasBaseline ? 'regression' : 'new_file_unmarked', currentGap, baselineGap });
    }
  }
  return failures;
}
