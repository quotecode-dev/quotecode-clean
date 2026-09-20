// Source-level regression guard (TEKANGO — Smart / Structured Quote RTL
// Geometry Remediation task, 2026-09-16, narrow Owner-reopen of RTL
// geometry only; hardened under the same-day RTL Remediation Closure
// follow-up per Codex's own review that the original guard was "useful
// but syntax-specific").
//
// This does NOT replace the real-browser geometry acceptance evidence
// (e2e/smart-quote-rtl-geometry.spec.js, and this task's own manual
// browser-harness verification) - per PROFLOW_PROJECT_CONTEXT.md §235,
// dir="rtl" presence and source inspection are never themselves RTL
// acceptance evidence, and functional/component tests do not certify
// mirroring. This guard exists only to stop the exact anti-pattern CLASS
// from silently reappearing in these two already-directed components,
// since this project's own history (§185) shows plain code review missed
// it before.
//
// The anti-pattern class: a `flexDirection`/`alignItems` value chosen by a
// direction-conditional ternary (`isHebrew ? A : B`, in EITHER branch
// order, using single or double quotes) written inside QuoteForm.jsx/
// AddItemWizard.jsx - both of which render fully inside an ancestor that
// already sets dir="rtl"/dir="ltr" (Dashboard.jsx's `.dash-app-shell`, and
// AddItemWizard's own dialog root). Under that inheritance, one single,
// unconditional physically-correct value (`'row'`/`'flex-start'`) already
// mirrors correctly for both languages - a direction-conditional ternary
// on `flexDirection`/`alignItems` in this exact scope is, by construction,
// a second, cancelling reversal, regardless of which branch holds which
// value or what the RTL-condition variable happens to be named. The
// original version of this guard matched only the one literal string this
// task fixed (`isHebrew ? 'row-reverse' : 'row'`); this version matches
// the shape - both branch orders, both quote styles, and the other
// RTL-condition variable names already used elsewhere in this codebase
// (`isRTL`/`isRtl`) - while staying scoped to these exact two CSS
// properties, since those are the two Codex actually proved defective
// here; it does not become a general flex/ternary lint pass.
//
// Deliberately narrow, not a blanket ban: one pre-existing occurrence
// (the client-phone dial-code row) is unchanged this task - out of the
// Owner-authorized RTL geometry scope (mode selector, editor header, terms
// header, compact item row, unit header, safe-removal dialog, wizard rows
// only) - and is not this guard's concern. Do not widen this guard to a
// repo-wide or zero-tolerance rule, and do not extend it to other CSS
// properties or components, without a separate Owner authorization.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DIR = path.dirname(fileURLToPath(import.meta.url));

// Matches `<var> ? 'A' : 'B'` for either quote style, keeping the two
// literal values as capture groups so the caller can reject same-value
// (no-op) ternaries and confirm the two values are the expected pair.
const RTL_VAR = '(?:isHebrew|isRTL|isRtl)';
function conditionalPattern(prop) {
  return new RegExp(`${prop}:\\s*${RTL_VAR}\\s*\\?\\s*(['"])([\\w-]+)\\1\\s*:\\s*(['"])([\\w-]+)\\3`, 'g');
}

const FLEX_DIRECTION_PATTERN = conditionalPattern('flexDirection');
const ALIGN_ITEMS_PATTERN = conditionalPattern('alignItems');

// A real double-reversal site is any direction-conditional flexDirection
// ternary whose two branches are exactly {row, row-reverse} (in either
// order), or a direction-conditional alignItems ternary whose two branches
// are exactly {flex-start, flex-end} (in either order). Anything else
// (e.g. a legitimate, unrelated conditional on some other pair of values)
// is not this defect class and must not be flagged.
function countDoubleReversalMatches(source, pattern, validPair) {
  let count = 0;
  for (const match of source.matchAll(pattern)) {
    const [, , first, , second] = match;
    if (validPair.includes(first) && validPair.includes(second) && first !== second) {
      count += 1;
    }
  }
  return count;
}

function countFlexDirectionOffenses(source) {
  return countDoubleReversalMatches(source, FLEX_DIRECTION_PATTERN, ['row', 'row-reverse']);
}

function countAlignItemsOffenses(source) {
  return countDoubleReversalMatches(source, ALIGN_ITEMS_PATTERN, ['flex-start', 'flex-end']);
}

describe('Smart Quote RTL geometry: no re-introduced double-reversal anti-pattern (QuoteForm.jsx, AddItemWizard.jsx only)', () => {
  it('QuoteForm.jsx: the 10 fixed sites stay fixed (exactly 1 pre-existing, out-of-scope occurrence remains: the client-phone dial-code row)', () => {
    const source = readFileSync(path.join(DIR, 'QuoteForm.jsx'), 'utf-8');
    expect(countFlexDirectionOffenses(source)).toBe(1);
    expect(countAlignItemsOffenses(source)).toBe(0);
  });

  it('AddItemWizard.jsx: the 3 fixed sites (StepIndicator narrow row, ReviewGroup, SummaryRow) stay fixed', () => {
    const source = readFileSync(path.join(DIR, 'AddItemWizard.jsx'), 'utf-8');
    expect(countFlexDirectionOffenses(source)).toBe(0);
    expect(countAlignItemsOffenses(source)).toBe(0);
  });

  it('detects the anti-pattern regardless of branch order or quote style (self-test, not a project-source assertion)', () => {
    const doubleQuoted = 'flexDirection: isHebrew ? "row-reverse" : "row"';
    const reversedBranches = "flexDirection: isRTL ? 'row' : 'row-reverse'";
    const alignVariant = "alignItems: isRtl ? 'flex-end' : 'flex-start'";
    const notThisClass = "flexDirection: isHebrew ? 'column' : 'column-reverse'"; // unrelated pair - must not match
    expect(countFlexDirectionOffenses(doubleQuoted)).toBe(1);
    expect(countFlexDirectionOffenses(reversedBranches)).toBe(1);
    expect(countAlignItemsOffenses(alignVariant)).toBe(1);
    expect(countFlexDirectionOffenses(notThisClass)).toBe(0);
  });
});
