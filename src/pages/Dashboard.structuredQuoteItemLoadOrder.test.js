import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Overnight Test Hardening + Priority-1 Completion Pack, Night Task B
// (2026-09-16): the write side of quote_items.sort_order was already fixed
// and tested (Dashboard.structuredQuoteSortOrder.test.js, "blocker 6") -
// itemsPayload has always correctly sent `sort_order: idx` on save. This is
// the companion READ-side gap: `quote.quote_items` (from fetchQuotes, no
// query-level ORDER BY - Postgres/PostgREST never guarantees row order
// without one) was mapped straight into form state with no client-side
// sort, in both handleEditClick and handleDuplicateQuote, while the
// sibling quote_sections/measurements mappings right next to each call
// were ALREADY correctly sorted by sort_order. A real, reproduced defect:
// after an edit that adds a second item and resaves, a fresh refetch could
// show the items in the wrong relative order - because the unsorted read
// then re-derives sort_order from `idx` at the NEXT save (see the write-
// side test above), silently persisting the corrupted order forward.
//
// Same style as the sibling test file above: a source-text assertion
// against the actual save/load-path code, not a full render+session
// integration test (the same documented reason applies here - this is a
// payload/mapping-shape regression, which lives in the source text itself
// more reliably than in an expensively-mocked render).
const dashboardSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'Dashboard.jsx'),
  'utf-8',
);

const SORT_BEFORE_MAP = /quote_items\s*\.slice\(\)\s*\.sort\(\(a, b\) => \(a\.sort_order \|\| 0\) - \(b\.sort_order \|\| 0\)\)\s*\.map\(item/g;

describe('Structured Quote item load order (Dashboard.jsx handleEditClick / handleDuplicateQuote)', () => {
  it('quote.quote_items is sorted by sort_order before being mapped into form state, at both call sites (edit and duplicate)', () => {
    const matches = dashboardSource.match(SORT_BEFORE_MAP) || [];
    expect(matches).toHaveLength(2);
  });

  it('handleEditClick sorts items the same way it already sorts sections (same established pattern, not a new one)', () => {
    const editClickIndex = dashboardSource.indexOf('const handleEditClick = async (quote) => {');
    expect(editClickIndex).toBeGreaterThan(-1);
    const nextFnIndex = dashboardSource.indexOf('const handleCreateNewQuoteClick', editClickIndex);
    const editClickBody = dashboardSource.slice(editClickIndex, nextFnIndex);

    expect(editClickBody).toMatch(/quote_sections \|\| \[\]\)\s*\n\s*\.slice\(\)\s*\n\s*\.sort\(\(a, b\) => \(a\.sort_order \|\| 0\) - \(b\.sort_order \|\| 0\)\)/);
    expect(editClickBody).toMatch(SORT_BEFORE_MAP);
  });

  it('handleDuplicateQuote sorts items the same way it already sorts sections (same established pattern, not a new one)', () => {
    const duplicateIndex = dashboardSource.indexOf('const handleDuplicateQuote = async (quote) => {');
    expect(duplicateIndex).toBeGreaterThan(-1);
    const nextFnIndex = dashboardSource.indexOf('\n  const ', duplicateIndex + 50);
    const duplicateBody = dashboardSource.slice(duplicateIndex, nextFnIndex > duplicateIndex ? nextFnIndex : duplicateIndex + 4000);

    expect(duplicateBody).toMatch(/quote_sections \|\| \[\]\)\.slice\(\)\.sort\(\(a, b\) => \(a\.sort_order \|\| 0\) - \(b\.sort_order \|\| 0\)\)/);
    expect(duplicateBody).toMatch(SORT_BEFORE_MAP);
  });
});
