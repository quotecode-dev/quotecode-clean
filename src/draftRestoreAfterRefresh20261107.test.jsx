import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen } from '@testing-library/react';
import { DraftConflictModal } from './components/QuoteDraftNotices';

// Owner console 2026-11-07 (typed: "...ולתקן את החזרה להצעה קיימת אחרי רענון..."): after a refresh in an existing quote with typed changes,
// the restore ran before the quotes list arrived, did not find the quote and said it "no longer exists" with its internal id.
const here = dirname(fileURLToPath(import.meta.url));
const dash = readFileSync(resolve(here, 'pages/Dashboard.jsx'), 'utf8').replace(/\r\n/g, '\n');
const effect = dash.slice(dash.indexOf('// Restore ONLY after the authenticated identity is known'), dash.indexOf('// Account switch on a still-mounted dashboard'));

describe('restore of an existing quote after a refresh', () => {
  it('an edit draft waits until the quotes list loaded; a new-quote draft does not wait', () => {
    expect(effect).toMatch(/if \(!showQuoteForm && dataLoad\.quotes !== 'ok' && topDraftIsEdit\(uid\)\) return;/);
    expect(effect).toMatch(/\}, \[session\?\.user\?\.id, isInitializing, dataLoad\.quotes\]\);/);
    // the once-per-user mark is set only when the restore really runs (not while it waits for the list)
    expect(effect.indexOf("dataLoad.quotes !== 'ok'")).toBeLessThan(effect.indexOf('restoreAttemptedForRef.current = uid'));
    expect(dash).toMatch(/const topDraftIsEdit = \(uid\) => \{\s*try \{ return quoteDraft\.store\.listForUser\(uid\)\[0\]\?\.envelope\?\.mode === 'edit'; \} catch \{ return false; \}/);
  });
  it('a quote that is really gone is never named by its internal id', () => {
    expect(dash).toMatch(/const draftLabelFor = \(q\) => \(q \? formatQuoteFallback\(q\) : ''\);/);
    expect(dash).not.toMatch(/String\(env\.quoteId\)\.slice\(0, 8\)/);
    const { rerender } = render(<DraftConflictModal conflict={{ label: '', reason: 'missing' }} isHebrew onReview={() => {}} onUseSaved={() => {}} onDiscard={() => {}} />);
    expect(screen.getByTestId('draft-conflict-modal').textContent).toContain('ההצעה כבר אינה קיימת');
    rerender(<DraftConflictModal conflict={{ label: '', reason: 'missing' }} isHebrew={false} onReview={() => {}} onUseSaved={() => {}} onDiscard={() => {}} />);
    expect(screen.getByTestId('draft-conflict-modal').textContent).toContain('The quote no longer exists');
    rerender(<DraftConflictModal conflict={{ label: 'A100717', reason: 'missing' }} isHebrew onReview={() => {}} onUseSaved={() => {}} onDiscard={() => {}} />);
    expect(screen.getByTestId('draft-conflict-modal').textContent).toContain('הצעה A100717 כבר אינה קיימת');
  });
});
