import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Owner requirement (Hot Quote Fixed Geometry / No Layout Shift task): the
// Hot Quote alert's rotating message must never drive the Dashboard header's
// height. Mounting the full Dashboard component here would require heavy
// Supabase/auth/routing mocks disproportionate to what this invariant needs
// (see PROFLOW_PROJECT_CONTEXT.md for the full-browser geometry verification
// this test complements, not replaces).
//
// חוק ברזל (UI Stability + Hot Quote Forensic Check task, 2026-09-08):
// המבנה עבר מ-`hotQuotesList.length > 0 && currentHotQuote && (...)` (מדלג
// על כל הבלוק - אפס-תוכן, לא רק אפס-נראות - כשאין הצעה חמה זכאית, בדיוק
// שורש-הבעיה שנחקר במשימה הזו) ל-ternary אמיתי: `... ? (real alert) : (
// empty state)` - התיבה עצמה תמיד קיימת בעץ ה-DOM, כך שגיאומטריית הדשבורד
// לעולם לא "קופצת" כשההצעה החמה היחידה עוברת ל-approved/paid (המעבר-סטטוס
// התקין שגרם להיעלמות שדווחה). העוגן לחיפוש הבלוק עודכן בהתאם.
const dashboardSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'Dashboard.jsx'),
  'utf-8',
);

function extractHotQuoteBlock(source) {
  const start = source.indexOf('{hotQuotesList.length > 0 && currentHotQuote ? (');
  const blockEnd = source.indexOf('</span>\n              )}', start);
  // חוק ברזל (Header UI Dark-Panel Correction task, 2026-09-09): the true
  // closing marker above has never actually matched this block's real
  // nesting (</div> sits between the last </span> and )}) - this extractor
  // has always silently relied on the fallback window, not the indexOf
  // match. 4500 (was 3500) gives real headroom so a content-only edit
  // (e.g. longer color-token names/values, no structural change) doesn't
  // silently truncate the captured block before its own closing tags.
  return source.slice(start, blockEnd > start ? blockEnd + '</span>'.length : start + 4500);
}

describe('Hot Quote fixed geometry (source-level regression guard)', () => {
  const block = extractHotQuoteBlock(dashboardSource);

  it('the Hot Quote container is unconditionally present (ternary, not `&&`-gated) - never skips rendering entirely when no quote qualifies', () => {
    expect(block).toMatch(/hotQuotesList\.length > 0 && currentHotQuote \? \(/);
    // The old all-or-nothing `&& (` gate (which made the whole block vanish,
    // the exact root cause investigated in this task) must be gone.
    expect(dashboardSource).not.toMatch(/hotQuotesList\.length > 0 && currentHotQuote && \(/);
  });

  it('renders the rotating client/quote message as a single truncated line, never a variable-height multi-line block', () => {
    expect(block).toMatch(/t\.hotQuoteAlert\(currentHotClientName, currentHotViewCount\)/);
    expect(block).toMatch(/whiteSpace:\s*hotQuoteExpanded\s*\?\s*['"]normal['"]\s*:\s*['"]nowrap['"]/);
    expect(block).toMatch(/textOverflow:\s*hotQuoteExpanded\s*\?\s*['"]clip['"]\s*:\s*['"]ellipsis['"]/);
  });

  it('reserves a fixed minHeight on the alert row (real-quote branch) so a short vs. long client name never shifts surrounding layout', () => {
    expect(block).toMatch(/minHeight:\s*['"]28px['"]/);
  });

  it('reserves the same fixed minHeight on the empty-state branch, so appearing/disappearing hot quotes never change Dashboard geometry', () => {
    const matches = block.match(/minHeight:\s*['"]28px['"]/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('the empty state shows the exact Owner-specified Hebrew and English copy, never fabricated client/view-count data', () => {
    expect(block).toMatch(/אין כרגע הצעה חמה/);
    expect(block).toMatch(/No hot quote right now/);
    expect(block).toMatch(/כשהצעה תיצפה 3 פעמים או יותר ועדיין לא תאושר, היא תופיע כאן\./);
    expect(block).toMatch(/A quote will appear here after 3 or more views while it is still awaiting approval\./);
  });

  it('the empty state never reuses the real-quote branch\'s client-name/view-count variables', () => {
    const elseBranchStart = block.indexOf(') : (');
    const elseBranch = block.slice(elseBranchStart);
    expect(elseBranch).not.toMatch(/currentHotClientName/);
    expect(elseBranch).not.toMatch(/currentHotViewCount/);
    expect(elseBranch).not.toMatch(/t\.hotQuoteAlert/);
  });

  it('the underlying eligibility formula (view_count>=3, excludes approved/paid) is unchanged by this task', () => {
    expect(dashboardSource).toMatch(
      /const hotQuotesList = quotes\.filter\(q => \(q\.view_count \|\| 0\) >= 3 && q\.status !== 'approved' && q\.status !== 'paid'\);/,
    );
  });
});
