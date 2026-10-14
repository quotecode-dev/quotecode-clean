// Task 33: every guided topic answers at once; follow-ups go through ONE send path (loading -> answer / error + retry).
// Task 34 (Codex review, finding 2): „משוב על המערכת” (suggestion = product idea) and „שיפור הצעת המחיר” (quote_improvement = an explicit
// review of the OPEN form) are separate. The review sends the CURRENT form snapshot only on the explicit click, in its own request field
// (helpContext untouched), never in later turns; an answer for another draft is not shown, one for an edited draft is marked stale.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import AIChatWidget from './AIChatWidget';
import { buildGuidedIntentReply, QUOTE_REVIEW_MESSAGES } from './utils/guidedIntentReplies';
import { GUIDED_INTENT_IDS } from './utils/guidedChatIntents';
import { buildQuoteDraftSnapshot } from './utils/quoteDraftSnapshot';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), getSession: vi.fn() }));
vi.mock('./shared/supabase', () => ({
  supabase: {
    functions: { invoke: (...args) => mocks.invoke(...args) },
    auth: { getSession: (...args) => mocks.getSession(...args), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
    from: () => ({ select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }),
  },
}));

const editorSources = (over = {}) => ({
  authenticated: true,
  editor: { open: true, mode: 'new', quoteId: null, pricedItemCount: 1, unpricedItemCount: 1 },
  workflow: { screen: 'quote_editor', mode: 'create', hasClient: false, hasProject: true, itemCount: 2, sectionCount: 0, structureMode: 'regular' },
  draft: { dirty: true },
  ...over,
});
const workflow = { screen: 'quote_editor', mode: 'create', hasClient: false, hasProject: true, itemCount: 2, sectionCount: 0, structureMode: 'regular', itemWizard: null };
// two drafts with the SAME number of items and different content
const DRAFT_A = [{ description: 'ריצוף חדר הורים', quantity: '1', unit_price: '120', pricing_unit: 'm2', quantity_source: 'manual', calculated_quantity: 40 }, { description: 'פירוק ריצוף', quantity: '35', unit_price: '' }];
const DRAFT_B = [{ description: 'צביעת סלון', quantity: '1', unit_price: '30', pricing_unit: 'm2', quantity_source: 'manual', calculated_quantity: 55 }, { description: 'התקנת מזגן', quantity: '1', unit_price: '450' }];
const snap = (items, subject = 'ריצוף') => buildQuoteDraftSnapshot({ items, subject, sections: [] });
const answer = (text = 'AI review') => ({ data: { contractVersion: 4, answer: text, navigation: null, selectedQuoteContext: null, error: null }, error: null });

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn();
  sessionStorage.clear();
  mocks.invoke.mockReset();
  mocks.getSession.mockReset();
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'u-1', email: 'u-1@example.com' } } } });
  mocks.invoke.mockResolvedValue(answer());
});
afterEach(() => cleanup());

describe('buildGuidedIntentReply (pure)', () => {
  it('every model-answer guided leaf + the editor action has an immediate reply in HE and EN', () => {
    for (const id of [...GUIDED_INTENT_IDS.filter((i) => i !== 'quotes' && i !== 'other'), 'quote_improvement']) {
      for (const isHebrew of [true, false]) {
        const r = buildGuidedIntentReply(id, { isHebrew, isDashboard: true, helpSources: editorSources() });
        expect(r && r.text.length > 10, `${id} ${isHebrew}`).toBe(true);
      }
    }
    expect(buildGuidedIntentReply('quotes', { isHebrew: true })).toBeNull();
  });
  it('„משוב על המערכת” is product feedback everywhere - inside the editor too, never item counts', () => {
    const r = buildGuidedIntentReply('suggestion', { isHebrew: true, isDashboard: true, helpSources: editorSources() });
    expect(r.text).toContain('רעיון לשיפור המערכת');
    expect(r.text).not.toMatch(/פריטים|פריט/);
    expect(r.actions).toEqual([]);
  });
  it('„שיפור הצעת המחיר” offers ONE explicit review action, says what is sent (no client data) and that nothing changes', () => {
    const r = buildGuidedIntentReply('quote_improvement', { isHebrew: true, isDashboard: true, helpSources: editorSources() });
    expect(r.text).toContain('בלי פרטי הלקוח');
    expect(r.text).toContain('לא שומרת, לא שולחת ולא משנה');
    expect(r.actions).toEqual([{ id: 'analyze_draft', kind: 'analyze_draft', label: 'בדקו את ההצעה שלפניי', message: QUOTE_REVIEW_MESSAGES.he }]);
    expect(buildGuidedIntentReply('quote_improvement', { isHebrew: false, isDashboard: true, helpSources: editorSources({ workflow: { itemCount: 0 } }) }).actions).toEqual([]);
    expect(buildGuidedIntentReply('quote_improvement', { isHebrew: true, isDashboard: true, helpSources: { editor: null } }).actions).toEqual([]);
  });
});

describe('quote draft snapshot (browser builder)', () => {
  it('carries only subject + per-item description / active quantity / unit / price; no placeholder rows, no client fields', () => {
    const s = buildQuoteDraftSnapshot({ subject: 'ריצוף', sections: [{ key: 'k1', name: 'סלון' }], items: [
      { description: 'ריצוף', quantity: '1', unit_price: '120', pricing_unit: 'm2', quantity_source: 'manual', calculated_quantity: 40, section_key: 'k1', client_name: 'X', id: 9 },
      { description: '  ', quantity: '1', unit_price: '' },
    ] });
    expect(s).toEqual({ version: 1, subject: 'ריצוף', items: [{ description: 'ריצוף', quantity: 40, unit: 'm2', unitPrice: 120, section: 'סלון' }] });
    expect(snap(DRAFT_A)).not.toEqual(snap(DRAFT_B));
  });
});

describe('AIChatWidget in the new-quote editor', () => {
  const open = async (getter) => {
    const view = render(<AIChatWidget isHebrew={true} isDashboard={true} currentArea="dashboard" workflowContext={workflow} helpSources={editorSources()} getQuoteDraftSnapshot={getter} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    fireEvent.click(screen.getByLabelText('צאט AI'));
    return view;
  };

  it('the menu offers the two separate actions; choosing review answers at once WITHOUT sending anything', async () => {
    await open(() => ({ identity: 'd1', snapshot: snap(DRAFT_A) }));
    expect(screen.getByRole('button', { name: 'שיפור הצעת המחיר' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'משוב על המערכת' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'שיפור הצעת המחיר' }));
    expect(screen.getByTestId('ai-guided-reply').getAttribute('data-intent')).toBe('quote_improvement');
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('the explicit review sends the CURRENT form content (two drafts, same item count, different content); helpContext is not widened; later turns carry no snapshot', async () => {
    let current = { identity: 'd1', snapshot: snap(DRAFT_A) };
    await open(() => current);
    fireEvent.click(screen.getByRole('button', { name: 'שיפור הצעת המחיר' }));
    fireEvent.click(screen.getByRole('button', { name: 'בדקו את ההצעה שלפניי' }));
    await screen.findByText('AI review');
    const first = mocks.invoke.mock.calls[0][1].body;
    expect(first.guidedIntent).toBe('quote_improvement');
    expect(first.draftSnapshot).toEqual(snap(DRAFT_A));
    expect(JSON.stringify(first.helpContext || {})).not.toContain('ריצוף חדר הורים');
    // an unsaved edit / another draft of the same size: the next review sends exactly what is in the form now
    current = { identity: 'd1', snapshot: snap([{ ...DRAFT_A[0], description: 'ריצוף חדר הורים קרמיקה 60×60' }, DRAFT_A[1]]) };
    const input = screen.getByPlaceholderText('שאל משהו...');
    fireEvent.change(input, { target: { value: 'ומה עם הפירוק?' } });
    fireEvent.submit(input.closest('form'));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2));
    expect(mocks.invoke.mock.calls[1][1].body.draftSnapshot).toBeUndefined(); // a typed follow-up is not a review
  });

  it('an answer for a draft that changed meanwhile is shown with a stale note; for another draft it is not shown', async () => {
    let resolve;
    mocks.invoke.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    let current = { identity: 'd1', snapshot: snap(DRAFT_A) };
    await open(() => current);
    fireEvent.click(screen.getByRole('button', { name: 'שיפור הצעת המחיר' }));
    fireEvent.click(screen.getByRole('button', { name: 'בדקו את ההצעה שלפניי' }));
    current = { identity: 'd1', snapshot: snap([DRAFT_A[0], { ...DRAFT_A[1], quantity: '50' }]) }; // unsaved edit during the review
    await act(async () => { resolve(answer('review of A')); });
    expect(await screen.findByText('review of A')).toBeTruthy();
    expect(screen.getByText(/ההצעה השתנתה בזמן הבדיקה/)).toBeTruthy();

    cleanup(); mocks.invoke.mockReset();
    mocks.invoke.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    let other = { identity: 'd1', snapshot: snap(DRAFT_A) };
    await open(() => other);
    fireEvent.click(screen.getByRole('button', { name: 'שיפור הצעת המחיר' }));
    fireEvent.click(screen.getByRole('button', { name: 'בדקו את ההצעה שלפניי' }));
    other = { identity: 'd2', snapshot: snap(DRAFT_B) }; // a different quote is open now
    await act(async () => { resolve(answer('review of A (late)')); });
    expect(screen.queryByText('review of A (late)')).toBeNull();
    expect(screen.getByText(/ההצעה שנבדקה כבר לא פתוחה/)).toBeTruthy();
  });

  it('a failed review shows an error with "try again"; retry re-reads the CURRENT form', async () => {
    mocks.invoke.mockRejectedValueOnce(new Error('network'));
    let current = { identity: 'd1', snapshot: snap(DRAFT_A) };
    await open(() => current);
    fireEvent.click(screen.getByRole('button', { name: 'שיפור הצעת המחיר' }));
    fireEvent.click(screen.getByRole('button', { name: 'בדקו את ההצעה שלפניי' }));
    const retry = await screen.findByTestId('ai-chat-retry');
    current = { identity: 'd1', snapshot: snap(DRAFT_B, 'צבע') };
    fireEvent.click(retry);
    await screen.findByText('AI review');
    expect(mocks.invoke.mock.calls[1][1].body.draftSnapshot).toEqual(snap(DRAFT_B, 'צבע'));
  });

  // Task 35: a quote longer than the review bound says so before the review runs (the user knows the answer covers the first 40 only)
  it('a long quote: the review says only the first 40 of N items are checked; the browser snapshot carries the real total', async () => {
    const long = Array.from({ length: 45 }, (_, i) => ({ description: `עבודה ${i + 1}`, quantity: '1', unit_price: '10' }));
    expect(snap(long).totalItems).toBe(45);
    expect(snap(long).items).toHaveLength(40);
    await open(() => ({ identity: 'd1', snapshot: snap(long) }));
    fireEvent.click(screen.getByRole('button', { name: 'שיפור הצעת המחיר' }));
    fireEvent.click(screen.getByRole('button', { name: 'בדקו את ההצעה שלפניי' }));
    await screen.findByText('AI review');
    expect(screen.getByText(/נבדקים רק 40 הפריטים הראשונים מתוך 45/)).toBeTruthy();
    expect(mocks.invoke.mock.calls[0][1].body.draftSnapshot.totalItems).toBe(45);
  });

  it('„משוב על המערכת” in the editor answers as product feedback; „עזרה בתהליך הנוכחי” still answers at once', async () => {
    await open(() => ({ identity: 'd1', snapshot: snap(DRAFT_A) }));
    fireEvent.click(screen.getByRole('button', { name: 'משוב על המערכת' }));
    expect(screen.getByTestId('ai-guided-reply').textContent).toContain('רעיון לשיפור המערכת');
    fireEvent.click(screen.getByRole('button', { name: 'חזרה' }));
    fireEvent.click(screen.getByRole('button', { name: 'עזרה בתהליך הנוכחי' }));
    expect(screen.getByTestId('ai-guided-reply').textContent).toContain('יוצרים הצעה חדשה');
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
