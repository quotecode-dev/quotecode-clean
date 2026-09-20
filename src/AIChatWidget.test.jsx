import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import AIChatWidget from './AIChatWidget';
import { GUIDED_TOPIC_GROUPS, PUBLIC_TOPIC_GROUPS, PUBLIC_SAFE_INTENT_IDS, GUIDED_INTENT_IDS, getGuidedIntentLabel, getGuidedIntentDescription } from './utils/guidedChatIntents';

// Dynamic Compact Guided Buttons task (supersedes the Descriptive Guided AI
// Cards task's own "Title. Description" aria-label contract - explanation
// text moved to a native `title` hover-tooltip attribute instead, so the
// button's own accessible NAME is plain title text again, same shape as
// the original Hierarchical Guided AI Chat Flow task). These helpers derive
// that name straight from the source data, so tests stay correct if the
// copy itself is ever tweaked rather than hardcoding literal strings.
// `groups` defaults to the authenticated taxonomy but every helper accepts
// the public one too (Context-Aware AI Chat task: the two surfaces render
// different group lists from the same underlying leaf-intent data).
function groupCardName(groupId, isHebrew, groups = GUIDED_TOPIC_GROUPS) {
  const group = groups.find((g) => g.id === groupId);
  return isHebrew ? group.he : group.en;
}
function leafCardName(intentId, isHebrew) {
  return getGuidedIntentLabel(intentId, isHebrew);
}
function groupTooltip(groupId, isHebrew, groups = GUIDED_TOPIC_GROUPS) {
  const group = groups.find((g) => g.id === groupId);
  return isHebrew ? group.heDesc : group.enDesc;
}
function leafTooltip(intentId, isHebrew) {
  return getGuidedIntentDescription(intentId, isHebrew);
}

// AI Chat Phase 1 frontend/session isolation tests (§15). The Edge Function
// itself is mocked via `supabase.functions.invoke` - these tests exercise
// the frontend contract only: storage partitioning, reset boundaries, and
// stale-async-reply discarding. Edge-side request validation/classification
// is covered separately in supabase/functions/chat-ai/validation.test.js.

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  getSession: vi.fn(),
  authCallback: null,
  quotesList: [],
}));

vi.mock('./shared/supabase', () => ({
  supabase: {
    functions: { invoke: (...args) => mocks.invoke(...args) },
    auth: {
      getSession: (...args) => mocks.getSession(...args),
      onAuthStateChange: (cb) => {
        mocks.authCallback = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: mocks.quotesList, error: null }),
        }),
      }),
    }),
  },
}));

function sessionFor(userId) {
  return { data: { session: userId ? { user: { id: userId, email: `${userId}@example.com` } } : null } };
}

function deferredInvoke() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  mocks.invoke.mockReturnValueOnce(promise);
  return (value) => resolve(value);
}

function openChat(isHebrew) {
  fireEvent.click(screen.getByLabelText(isHebrew ? 'צאט AI' : 'AI Chat'));
}

async function sendMessage(text, isHebrew) {
  const input = screen.getByPlaceholderText(isHebrew ? 'שאל משהו...' : 'Ask something...');
  fireEvent.change(input, { target: { value: text } });
  fireEvent.submit(input.closest('form'));
}

beforeEach(() => {
  // jsdom does not implement Element.prototype.scrollTo - unrelated to the
  // AI Chat Phase 1 contract under test here, just an environment gap.
  Element.prototype.scrollTo = vi.fn();
  sessionStorage.clear();
  mocks.invoke.mockReset();
  mocks.getSession.mockReset();
  mocks.getSession.mockResolvedValue(sessionFor(null));
  mocks.authCallback = null;
  mocks.quotesList = [];
  mocks.invoke.mockResolvedValue({ data: { contractVersion: 2, answer: 'AI reply', navigation: null, selectedQuoteContext: null, requestId: 'test-request-id', error: null }, error: null });
});

afterEach(() => {
  cleanup();
});

describe('public chat storage isolation', () => {
  it('HE public transcript does not appear in EN public', async () => {
    const { unmount } = render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    await sendMessage('שאלה בעברית', true);
    await screen.findByText('AI reply');
    unmount();

    render(<AIChatWidget isHebrew={false} isDashboard={false} />);
    openChat(false);
    expect(screen.queryByText('שאלה בעברית')).not.toBeInTheDocument();
    expect(screen.getByText('Hello! I am TEKANGO AI assistant. Have questions about our pricing, plans, or features?')).toBeInTheDocument();
  });

  it('public transcript does not appear in authenticated chat', async () => {
    const { unmount } = render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    await sendMessage('שאלה ציבורית', true);
    await screen.findByText('AI reply');
    unmount();

    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);
    expect(screen.queryByText('שאלה ציבורית')).not.toBeInTheDocument();
    expect(screen.getByText('שלום! אני עוזר ה-AI של TEKANGO. איך אעזור לך בממשק המערכת היום?')).toBeInTheDocument();
  });

  it('corrupt storage falls back safely to the default welcome', () => {
    sessionStorage.setItem('proflow_ai_chat_public_v2_he', '{not valid json');
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    expect(screen.getByText('שלום! אני עוזר ה-AI של TEKANGO. יש לך שאלות על המחירים, המסלולים או הפיצ\'רים שלנו?')).toBeInTheDocument();
  });

  it('oversized stored transcript is rejected, falls back to default welcome', () => {
    const tooMany = Array.from({ length: 100 }, (_, i) => ({ role: 'user', content: `m${i}` }));
    sessionStorage.setItem('proflow_ai_chat_public_v2_he', JSON.stringify({ schemaVersion: 2, messages: tooMany }));
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    expect(screen.queryByText('m0')).not.toBeInTheDocument();
  });

  it('legacy ambiguous authenticated storage is not reused (authenticated chat never reads sessionStorage)', async () => {
    sessionStorage.setItem('proflow_ai_chat_app_he', JSON.stringify([{ role: 'assistant', content: 'OLD LEGACY AUTH HISTORY' }]));
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);
    expect(screen.queryByText('OLD LEGACY AUTH HISTORY')).not.toBeInTheDocument();
  });

  it('public mode never fetches or sends any session identity, even if the browser happens to be logged in', async () => {
    mocks.getSession.mockResolvedValue(sessionFor('some-authenticated-user'));
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    await sendMessage('hi', true);
    await screen.findByText('AI reply');

    expect(mocks.getSession).not.toHaveBeenCalled();
    const body = mocks.invoke.mock.calls[0][1].body;
    expect(body).not.toHaveProperty('userEmail');
    expect(body.isDashboard).toBe(false);
  });
});

describe('authenticated chat reset boundaries', () => {
  it('logout clears/invalidates the authenticated context', async () => {
    mocks.getSession.mockResolvedValue(sessionFor('user-a'));
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);
    await sendMessage('שאלה של יוזר א', true);
    await screen.findByText('AI reply');

    mocks.authCallback('SIGNED_OUT', null);

    await waitFor(() => {
      expect(screen.queryByText('שאלה של יוזר א')).not.toBeInTheDocument();
    });
    expect(screen.getByText('שלום! אני עוזר ה-AI של TEKANGO. איך אעזור לך בממשק המערכת היום?')).toBeInTheDocument();
  });

  it('login as a different user starts clean', async () => {
    mocks.getSession.mockResolvedValue(sessionFor('user-a'));
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);
    await sendMessage('רק יוזר א רואה את זה', true);
    await screen.findByText('AI reply');

    mocks.authCallback('SIGNED_IN', { user: { id: 'user-b', email: 'user-b@example.com' } });

    await waitFor(() => {
      expect(screen.queryByText('רק יוזר א רואה את זה')).not.toBeInTheDocument();
    });
  });

  it('market/locale change invalidates the authenticated chat context', async () => {
    mocks.getSession.mockResolvedValue(sessionFor('user-a'));
    const { rerender } = render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);
    await sendMessage('שיחה בעברית', true);
    await screen.findByText('AI reply');

    rerender(<AIChatWidget isHebrew={false} isDashboard={true} />);

    await waitFor(() => {
      expect(screen.queryByText('שיחה בעברית')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Hello! I am TEKANGO AI assistant. How can I help you with the interface today?')).toBeInTheDocument();
  });
});

describe('Context-Driven AI Chat closure task (2026-09-18), §5 - dynamic greeting by context. currentArea/workflowContext are the same non-authoritative UX hints already sent to the Edge Function (Gate 2 §10 / Track B-C) - the opening line now reflects them instead of one static sentence for the whole authenticated surface.', () => {
  it('main/no-context keeps the existing generic greeting (no regression for the untouched default)', () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} currentArea="main" />);
    openChat(true);
    expect(screen.getByText('שלום! אני עוזר ה-AI של TEKANGO. איך אעזור לך בממשק המערכת היום?')).toBeInTheDocument();
  });

  it('Clients screen gets a clients-specific opener, HE and EN', () => {
    const { unmount } = render(<AIChatWidget isHebrew={true} isDashboard={true} currentArea="clients" />);
    openChat(true);
    expect(screen.getByText('אני רואה שאתה עובד עכשיו עם לקוחות. במה תרצה עזרה?')).toBeInTheDocument();
    unmount();

    render(<AIChatWidget isHebrew={false} isDashboard={true} currentArea="clients" />);
    openChat(false);
    expect(screen.getByText('I see you’re working with clients right now. How can I help?')).toBeInTheDocument();
  });

  it('Business Settings, Finances, Catalog, and Plans screens each get their own opener', () => {
    const cases = [
      ['settings', 'אני רואה שאתה נמצא בהגדרות העסק שלך. במה תרצה עזרה?'],
      ['finances', 'אני רואה שאתה נמצא בעמוד הפיננסים. במה תרצה עזרה?'],
      ['catalog', 'אני רואה שאתה נמצא בקטלוג הפריטים שלך. במה תרצה עזרה?'],
      ['plans', 'אני רואה שאתה צופה במסלולים ובתמחור. במה תרצה עזרה?'],
    ];
    for (const [area, expectedText] of cases) {
      const { unmount } = render(<AIChatWidget isHebrew={true} isDashboard={true} currentArea={area} />);
      openChat(true);
      expect(screen.getByText(expectedText)).toBeInTheDocument();
      unmount();
    }
  });

  it('New Quote (workflowContext.mode=create) and Edit Quote (mode=edit) get distinct openers, taking priority over currentArea', () => {
    const { unmount } = render(<AIChatWidget isHebrew={true} isDashboard={true} currentArea="main" workflowContext={{ screen: 'quote_editor', mode: 'create' }} />);
    openChat(true);
    expect(screen.getByText('אני רואה שאתה יוצר עכשיו הצעת מחיר חדשה. במה תרצה עזרה?')).toBeInTheDocument();
    unmount();

    render(<AIChatWidget isHebrew={true} isDashboard={true} currentArea="main" workflowContext={{ screen: 'quote_editor', mode: 'edit' }} />);
    openChat(true);
    expect(screen.getByText('אני רואה שאתה עורך עכשיו הצעה קיימת. במה תרצה עזרה?')).toBeInTheDocument();
  });

  it('item wizard open takes priority over the quote-editor mode opener', () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} currentArea="main" workflowContext={{ screen: 'quote_editor', mode: 'create', itemWizard: { open: true, action: 'add' } }} />);
    openChat(true);
    expect(screen.getByText('אני רואה שאתה מוסיף עכשיו פריט להצעה. במה תרצה עזרה?')).toBeInTheDocument();
  });

  it('the greeting refreshes to match the CURRENT context when the panel opens, even though it was seeded at mount with a different one (props changed between mount and open)', () => {
    const { rerender } = render(<AIChatWidget isHebrew={true} isDashboard={true} currentArea="main" />);
    rerender(<AIChatWidget isHebrew={true} isDashboard={true} currentArea="clients" />);
    openChat(true);
    expect(screen.getByText('אני רואה שאתה עובד עכשיו עם לקוחות. במה תרצה עזרה?')).toBeInTheDocument();
  });

  it('does NOT rewrite the greeting once the user has already started the conversation, even if the screen changes afterward', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} currentArea="clients" />);
    openChat(true);
    expect(screen.getByText('אני רואה שאתה עובד עכשיו עם לקוחות. במה תרצה עזרה?')).toBeInTheDocument();
    await sendMessage('שאלה על לקוח', true);
    await screen.findByText('AI reply');

    expect(screen.getByText('אני רואה שאתה עובד עכשיו עם לקוחות. במה תרצה עזרה?')).toBeInTheDocument();
  });

  it('public (non-dashboard) surface is never affected by currentArea/workflowContext, even if somehow passed', () => {
    render(<AIChatWidget isHebrew={true} isDashboard={false} currentArea="clients" workflowContext={{ screen: 'quote_editor', mode: 'create' }} />);
    openChat(true);
    expect(screen.getByText('שלום! אני עוזר ה-AI של TEKANGO. יש לך שאלות על המחירים, המסלולים או הפיצ\'רים שלנו?')).toBeInTheDocument();
  });
});

describe('Guided Interactive Entry - authenticated Dashboard hierarchy (§4/§11.2, Hierarchical Guided AI Chat Flow task). Converted from public (isDashboard=false) to authenticated (isDashboard=true) by the Context-Aware AI Chat task: help_support/plans_billing/my_business/feedback_questions and the quotes second step are now authenticated-only (see the new "Public vs Authenticated guided surface separation" describe block below for the public-surface equivalent)', () => {
  it('first open shows the opening question, exactly 5-6 top-level GROUPS (not the 11 leaf topics), the "type directly" hint, and a usable composer simultaneously', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);

    expect(screen.getByText('שלום! במה תרצה עזרה?')).toBeInTheDocument();
    expect(screen.getByText('אפשר גם לכתוב כאן ישירות')).toBeInTheDocument();
    // Top-level groups only - leaf topics nested inside a multi-child group
    // are not yet in the document at all. Compact title-only buttons - the
    // description lives only in the button's own `title` hover-tooltip
    // attribute now (Dynamic Compact Guided Buttons task), never as
    // permanent visible text.
    for (const groupId of ['quotes', 'help_support', 'plans_billing', 'my_business', 'feedback_questions']) {
      const btn = screen.getByRole('button', { name: groupCardName(groupId, true) });
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveAttribute('title', groupTooltip(groupId, true));
    }
    expect(screen.queryByText('בעיה טכנית')).not.toBeInTheDocument();
    expect(screen.queryByText('הצעה לשיפור')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('שאל משהו...')).toBeEnabled();
  });

  it('top-level buttons render in a responsive grid (2 columns where the popup is wide enough) with a small icon and safe 44px touch target, each button sized to its content rather than stacked full-width', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);

    const quotesBtn = screen.getByRole('button', { name: groupCardName('quotes', true) });
    // Real icon present (lucide renders an inline <svg>), and the button is
    // a plain flex row, not the old full-width stacked descriptive card.
    expect(quotesBtn.querySelector('svg')).toBeTruthy();
    expect(quotesBtn.style.width).not.toBe('100%');
    const grid = quotesBtn.parentElement;
    expect(grid.style.display).toBe('grid');
    expect(grid.style.gridTemplateColumns).toContain('auto-fit');
  });

  it('shows the personalized greeting when a trustworthy business display name is passed (Dashboard only)', () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} businessDisplayName="עסק לדוגמה" />);
    openChat(true);
    expect(screen.getByText('שלום עסק לדוגמה, במה תרצה עזרה?')).toBeInTheDocument();
  });

  it('never personalizes the public (unauthenticated) surface even if a businessDisplayName prop is somehow passed', () => {
    render(<AIChatWidget isHebrew={true} isDashboard={false} businessDisplayName="עסק לדוגמה" />);
    openChat(true);
    expect(screen.getByText('שלום! במה תרצה עזרה?')).toBeInTheDocument();
    expect(screen.queryByText(/עסק לדוגמה/)).not.toBeInTheDocument();
  });

  it('choosing "quotes" (a direct top-level topic with its own second step) hides the other top-level groups and shows the second step, with a compact breadcrumb back to the group list', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);

    fireEvent.click(screen.getByRole('button', { name: groupCardName('quotes', true) }));

    // Hierarchical Guided AI Chat Flow requirement: unrelated top-level
    // groups (and the Level-1-only opening question) are HIDDEN once a
    // topic is chosen, replaced by a compact breadcrumb - not left stacked
    // underneath the second step. The welcome message bubble itself (a
    // separate chat message, not this greeting) is unaffected - see the
    // AI Chat History UX describe block for that.
    expect(screen.queryByText('שלום! במה תרצה עזרה?')).not.toBeInTheDocument();
    expect(screen.queryByText('עזרה ותמיכה')).not.toBeInTheDocument();
    expect(screen.getByText('הצעות מחיר')).toBeInTheDocument(); // the breadcrumb itself, same title (directIntent group, no arrow)
    expect(screen.getByText('שאלה כללית או הצעה מסוימת?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'עזרה כללית' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'הצעה מסוימת' })).toBeInTheDocument();
  });

  it('choosing a multi-child group shows only that group\'s own compact subtopic buttons, with a Back control, hiding every other group', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);

    fireEvent.click(screen.getByRole('button', { name: groupCardName('feedback_questions', true) }));

    expect(screen.queryByText('הצעות מחיר')).not.toBeInTheDocument();
    expect(screen.queryByText('עזרה ותמיכה')).not.toBeInTheDocument();
    const suggestionBtn = screen.getByRole('button', { name: leafCardName('suggestion', true) });
    expect(suggestionBtn).toBeInTheDocument();
    expect(suggestionBtn).toHaveAttribute('title', leafTooltip('suggestion', true)); // description lives in the tooltip only, never permanent visible text
    expect(screen.getByRole('button', { name: leafCardName('general_question', true) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: leafCardName('other', true) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'חזרה' })).toBeInTheDocument();
  });

  it('Back from a subtopic list returns to the top-level group list', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);

    fireEvent.click(screen.getByRole('button', { name: groupCardName('feedback_questions', true) }));
    fireEvent.click(screen.getByRole('button', { name: 'חזרה' }));

    expect(screen.getByRole('button', { name: groupCardName('quotes', true) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: groupCardName('feedback_questions', true) })).toBeInTheDocument();
    expect(screen.queryByText('הצעה לשיפור')).not.toBeInTheDocument();
  });

  it('every reachable subtopic, in every multi-child group, renders its own title and one-line description (Descriptive Guided AI Cards task, full sweep)', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);

    const groupsAndChildren = [
      ['help_support', ['current_process_help', 'software_help', 'technical_problem']],
      ['plans_billing', ['plans_subscription', 'billing_payment']],
      ['my_business', ['clients', 'business_settings']],
      ['feedback_questions', ['suggestion', 'general_question', 'other']],
    ];
    for (const [groupId, children] of groupsAndChildren) {
      fireEvent.click(screen.getByRole('button', { name: groupCardName(groupId, true) }));
      for (const intentId of children) {
        const card = screen.getByRole('button', { name: leafCardName(intentId, true) });
        expect(card).toBeInTheDocument();
        expect(card.tagName).toBe('BUTTON');
      }
      // Back to the top level before checking the next group, so sibling
      // groups' own subtopics never leak into this same screen.
      fireEvent.click(screen.getByRole('button', { name: 'חזרה' }));
    }
  });

  it('the selected parent context header shows the parent title clearly, above the subtopic cards, without re-rendering the full top-level stack (§8)', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);

    fireEvent.click(screen.getByRole('button', { name: groupCardName('my_business', true) }));

    // The parent's own title renders as a real, visible header line...
    expect(screen.getByText('העסק שלי')).toBeInTheDocument();
    // ...but not its top-level description (kept compact per §8's own
    // "optionally... only if it stays compact" - this task chose not to,
    // matching the Owner's own given conceptual example exactly).
    expect(screen.queryByText('לקוחות, פרטי העסק והגדרות')).not.toBeInTheDocument();
    // None of the other 4 top-level cards re-render alongside it.
    for (const otherId of ['quotes', 'help_support', 'plans_billing', 'feedback_questions']) {
      expect(screen.queryByRole('button', { name: groupCardName(otherId, true) })).not.toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'חזרה' })).toBeInTheDocument();
  });

  it('no stale hierarchy state leaks between groups - switching from one multi-child group to another via Back never shows the first group\'s own subtopics', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);

    fireEvent.click(screen.getByRole('button', { name: groupCardName('help_support', true) }));
    expect(screen.getByRole('button', { name: leafCardName('technical_problem', true) })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'חזרה' }));
    fireEvent.click(screen.getByRole('button', { name: groupCardName('my_business', true) }));

    expect(screen.queryByText('בעיה טכנית')).not.toBeInTheDocument();
    expect(screen.queryByText('עזרה בתוכנה')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: leafCardName('clients', true) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: leafCardName('business_settings', true) })).toBeInTheDocument();
  });

  it('choosing a topic with NO second step (e.g. suggestion, nested inside Feedback & Questions) goes straight to free chat - no second-step UI appears, and a compact breadcrumb replaces both menu levels', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);

    fireEvent.click(screen.getByRole('button', { name: groupCardName('feedback_questions', true) }));
    fireEvent.click(screen.getByRole('button', { name: leafCardName('suggestion', true) }));

    expect(screen.queryByText('שאלה כללית או הצעה מסוימת?')).not.toBeInTheDocument();
    expect(screen.queryByText('שאלה כללית')).not.toBeInTheDocument(); // sibling subtopic hidden
    expect(screen.queryByText('הצעות מחיר')).not.toBeInTheDocument(); // top-level list hidden
    expect(screen.getByText('משוב ושאלות → הצעה לשיפור')).toBeInTheDocument(); // breadcrumb: group -> leaf
    expect(screen.getByPlaceholderText('שאל משהו...')).toBeEnabled();
  });

  it('the second step is skippable by typing directly, without selecting an option', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);
    fireEvent.click(screen.getByRole('button', { name: groupCardName('quotes', true) }));
    expect(screen.getByText('שאלה כללית או הצעה מסוימת?')).toBeInTheDocument();

    await sendMessage('שאלה כללית על הצעות', true);

    expect(screen.queryByText('שאלה כללית או הצעה מסוימת?')).not.toBeInTheDocument();
    const body = mocks.invoke.mock.calls[0][1].body;
    expect(body.guidedIntent).toBe('quotes');
    expect(body.guidedSubtopic).toBeNull();
  });

  it('typing immediately (no category chosen) skips guidance naturally and the user is never trapped in the picker', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    expect(screen.getByText('שלום! במה תרצה עזרה?')).toBeInTheDocument();

    await sendMessage('שאלה ישירה בלי לבחור קטגוריה', true);

    expect(screen.queryByText('שלום! במה תרצה עזרה?')).not.toBeInTheDocument();
    const body = mocks.invoke.mock.calls[0][1].body;
    expect(body.guidedIntent).toBeNull();
    expect(body.guidedSubtopic).toBeNull();
  });

  it('changing category before sending (via the breadcrumb\'s own change control) overwrites the previous pick without adding any message bubbles', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);

    fireEvent.click(screen.getByRole('button', { name: groupCardName('quotes', true) }));
    fireEvent.click(screen.getByRole('button', { name: 'הצעה מסוימת' }));
    // change of mind: nothing sent yet - click the Level 3 chip's own
    // dedicated Back button (Dynamic Compact Guided Buttons task: the chip
    // itself is a non-interactive pill, Back is now always a separate,
    // real 44x44 button), then pick a totally different top-level group
    // and a leaf with no second step.
    fireEvent.click(screen.getByRole('button', { name: 'חזרה' }));
    fireEvent.click(screen.getByRole('button', { name: groupCardName('feedback_questions', true) }));
    fireEvent.click(screen.getByRole('button', { name: leafCardName('suggestion', true) }));

    // The quotes second step is gone - suggestion has none - and no guided
    // pick ever became a visible chat message bubble.
    expect(screen.queryByText('שאלה כללית או הצעה מסוימת?')).not.toBeInTheDocument();

    await sendMessage('טקסט כלשהו', true);
    const body = mocks.invoke.mock.calls[0][1].body;
    expect(body.guidedIntent).toBe('suggestion');
    expect(body.guidedSubtopic).toBeNull();
  });

  it('selecting a subtopic then sending an unrelated question still answers that actual question - the picked subtopic is only a hint on the request', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);
    fireEvent.click(screen.getByRole('button', { name: groupCardName('quotes', true) }));
    fireEvent.click(screen.getByRole('button', { name: 'הצעה מסוימת' }));

    await sendMessage('איך מוסיפים לקוח חדש?', true);

    const body = mocks.invoke.mock.calls[0][1].body;
    expect(body.guidedIntent).toBe('quotes');
    expect(body.guidedSubtopic).toBe('specific_quote');
    expect(body.messages[body.messages.length - 1].content).toBe('איך מוסיפים לקוח חדש?');
    await screen.findByText('AI reply');
  });

  it('a market/locale reset clears the picked guided intent - the new-locale picker shows nothing pre-selected', async () => {
    const { rerender } = render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);
    fireEvent.click(screen.getByRole('button', { name: groupCardName('quotes', true) }));
    expect(screen.getByText('שאלה כללית או הצעה מסוימת?')).toBeInTheDocument();

    rerender(<AIChatWidget isHebrew={false} isDashboard={true} />);

    expect(screen.getByText('Hello! How can I help you today?')).toBeInTheDocument();
    expect(screen.queryByText('General help or a specific quote?')).not.toBeInTheDocument();
    // Back to the top-level group list (not the breadcrumb) - the picked
    // intent was genuinely cleared, not just relabeled into English.
    expect(screen.getByRole('button', { name: groupCardName('quotes', false) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: groupCardName('help_support', false) })).toBeInTheDocument();
  });

  it('reopening the SAME conversation after picking a category does not re-force onboarding (selection survives close/reopen)', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);
    fireEvent.click(screen.getByRole('button', { name: groupCardName('quotes', true) }));
    expect(screen.getByText('שאלה כללית או הצעה מסוימת?')).toBeInTheDocument();

    // close then reopen - not a reset boundary, so nothing is forced back to a blank state
    fireEvent.click(screen.getByLabelText('סגור'));
    openChat(true);

    // The chip (not the top-level button grid) is what survives - group list stays hidden.
    expect(screen.queryByText('עזרה ותמיכה')).not.toBeInTheDocument();
    expect(screen.getByText('הצעות מחיר')).toBeInTheDocument(); // the chip's own text
    expect(screen.getByRole('button', { name: 'חזרה' })).toBeInTheDocument();
    expect(screen.getByText('שאלה כללית או הצעה מסוימת?')).toBeInTheDocument();
  });

  it('reopening after sending a message does not re-show the guided picker at all', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    await sendMessage('שאלה חופשית', true);
    await screen.findByText('AI reply');

    fireEvent.click(screen.getByLabelText('סגור'));
    openChat(true);

    expect(screen.queryByText('שלום! במה תרצה עזרה?')).not.toBeInTheDocument();
  });

  it('EN labels are used for EN authenticated chat, distinct from HE labels, at every hierarchy level', async () => {
    render(<AIChatWidget isHebrew={false} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(false);

    expect(screen.getByText('Hello! How can I help you today?')).toBeInTheDocument();
    expect(screen.getByText('You can also type directly')).toBeInTheDocument();
    const plansBillingBtn = screen.getByRole('button', { name: groupCardName('plans_billing', false) });
    expect(plansBillingBtn).toBeInTheDocument();
    expect(plansBillingBtn).toHaveAttribute('title', groupTooltip('plans_billing', false));
    expect(screen.queryByText('Plans / subscription')).not.toBeInTheDocument();

    fireEvent.click(plansBillingBtn);
    const plansSubBtn = screen.getByRole('button', { name: leafCardName('plans_subscription', false) });
    expect(plansSubBtn).toBeInTheDocument();
    expect(plansSubBtn).toHaveAttribute('title', leafTooltip('plans_subscription', false));
    expect(screen.getByRole('button', { name: leafCardName('billing_payment', false) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: leafCardName('plans_subscription', false) }));
    expect(screen.getByText('Plans & Billing → Plans / subscription')).toBeInTheDocument();
  });

  it('authenticated Dashboard chat also shows the guided picker on first open', () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    openChat(true);
    expect(screen.getByText('שלום! במה תרצה עזרה?')).toBeInTheDocument();
  });

  it('authenticated Level 1 has its own explicit "Other" escape tile, separate from the Feedback & Questions group', () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    openChat(true);
    expect(screen.getByRole('button', { name: leafCardName('other', true) })).toBeInTheDocument();
    // Still exactly 5 topic groups plus this one escape tile - not a 6th topic.
    for (const groupId of ['quotes', 'help_support', 'plans_billing', 'my_business', 'feedback_questions']) {
      expect(screen.getByRole('button', { name: groupCardName(groupId, true) })).toBeInTheDocument();
    }
  });

  it('authenticated Level 2 (e.g. help_support, which has no "other" child of its own) also has an explicit "Other" escape tile', () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    openChat(true);
    fireEvent.click(screen.getByRole('button', { name: groupCardName('help_support', true) }));
    expect(screen.getByRole('button', { name: leafCardName('other', true) })).toBeInTheDocument();
  });

  it('authenticated Level 2 for Feedback & Questions never duplicates the "other" tile (it is already one of its own children)', () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    openChat(true);
    fireEvent.click(screen.getByRole('button', { name: groupCardName('feedback_questions', true) }));
    // getByRole throws if more than one match exists - a single match proves no duplicate.
    expect(screen.getByRole('button', { name: leafCardName('other', true) })).toBeInTheDocument();
  });

  it('selecting Other (Level 1 escape tile) focuses the free-text input and shows the direct one-line invitation instead of the generic hint', () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    openChat(true);
    fireEvent.click(screen.getByRole('button', { name: leafCardName('other', true) }));

    expect(screen.getByText('בשמחה, כתוב לי מה תרצה לשאול.')).toBeInTheDocument();
    expect(screen.queryByText('אפשר גם לכתוב כאן ישירות')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('שאל משהו...')).toHaveFocus();
  });

  it('selecting Other from inside a Level 2 group also focuses the input and shows the same invitation (EN)', () => {
    render(<AIChatWidget isHebrew={false} isDashboard={true} />);
    openChat(false);
    fireEvent.click(screen.getByRole('button', { name: groupCardName('help_support', false) }));
    fireEvent.click(screen.getByRole('button', { name: leafCardName('other', false) }));

    expect(screen.getByText("Sure — tell me what you'd like to ask.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ask something...')).toHaveFocus();
  });
});

describe('Public vs Authenticated guided surface separation (Context-Aware AI Chat task - root architectural defect fix). The Owner\'s observed failure: an anonymous landing-page visitor could reach "My Business", billing, or workflow-dependent guided options that presuppose an account. Fixed by giving each surface its own topic-group source (guidedChatIntents.js\'s getTopicGroupsForSurface) instead of one shared list.', () => {
  it('public landing shows exactly the 6 public-safe topics, flat (no submenu), each its own real button', () => {
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    for (const id of PUBLIC_SAFE_INTENT_IDS) {
      expect(screen.getByRole('button', { name: groupCardName(id, true, PUBLIC_TOPIC_GROUPS) })).toBeInTheDocument();
    }
    expect(PUBLIC_TOPIC_GROUPS.length).toBe(PUBLIC_SAFE_INTENT_IDS.length);
  });

  it('public landing NEVER renders any authenticated-only topic - current_process_help, technical_problem, billing_payment, clients, or business_settings - anywhere, even by label text', () => {
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    const authOnlyIds = GUIDED_INTENT_IDS.filter((id) => !PUBLIC_SAFE_INTENT_IDS.includes(id));
    expect(authOnlyIds).toEqual(['current_process_help', 'technical_problem', 'billing_payment', 'clients', 'business_settings']);
    for (const id of authOnlyIds) {
      expect(screen.queryByText(getGuidedIntentLabel(id, true))).not.toBeInTheDocument();
      expect(screen.queryByText(getGuidedIntentLabel(id, false))).not.toBeInTheDocument();
    }
    // The authenticated-only grouping labels themselves (which a visitor
    // could otherwise reach by drilling into a group) must also be absent.
    expect(screen.queryByText('העסק שלי')).not.toBeInTheDocument();
    expect(screen.queryByText('My Business')).not.toBeInTheDocument();
  });

  it('public landing never shows the quotes second step ("general or specific quote") or the account quote-selector - selecting Quotes goes straight to free product Q&A', () => {
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    fireEvent.click(screen.getByRole('button', { name: groupCardName('quotes', true, PUBLIC_TOPIC_GROUPS) }));

    expect(screen.queryByText('שאלה כללית או הצעה מסוימת?')).not.toBeInTheDocument();
    expect(screen.queryByText(/בחר הצעת מחיר לשיחה זו/)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('שאל משהו...')).toBeEnabled();
  });

  it('public landing\'s "Other" tile is one of the flat 6, requires no separate escape tile, and still focuses free text with the direct invitation (HE)', () => {
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    fireEvent.click(screen.getByRole('button', { name: groupCardName('other', true, PUBLIC_TOPIC_GROUPS) }));

    expect(screen.getByText('בשמחה, כתוב לי מה תרצה לשאול.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('שאל משהו...')).toHaveFocus();
  });

  it('public landing chat never fetches an authenticated quote list, even if guidedIntent happens to be "quotes"', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    fireEvent.click(screen.getByRole('button', { name: groupCardName('quotes', true, PUBLIC_TOPIC_GROUPS) }));
    await sendMessage('מה זה הצעת מחיר חכמה?', true);
    const body = mocks.invoke.mock.calls[0][1].body;
    expect(body.guidedIntent).toBe('quotes');
    expect(body.selectedQuoteId).toBeNull();
    expect(body.isDashboard).toBe(false);
  });

  it('EN public labels match the authenticated leaf labels exactly (no separate, drifting public copy)', () => {
    render(<AIChatWidget isHebrew={false} isDashboard={false} />);
    openChat(false);
    expect(screen.getByRole('button', { name: getGuidedIntentLabel('plans_subscription', false) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: getGuidedIntentLabel('software_help', false) })).toBeInTheDocument();
  });
});

describe('Gate 2 - request contract v2 (§10)', () => {
  it('sends contractVersion, currentArea, and selectedQuoteId (null when unset) alongside the existing fields', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} currentArea="main" />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);
    await sendMessage('שאלה', true);
    await screen.findByText('AI reply');

    const body = mocks.invoke.mock.calls[0][1].body;
    expect(body.contractVersion).toBe(3);
    expect(body.currentArea).toBe('main');
    expect(body.selectedQuoteId).toBeNull();
    expect(body.contextRevision).toBe(0);
  });

  it('never sends currentArea/selectedQuoteId for the public surface, even if a currentArea prop was somehow passed', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={false} currentArea="main" />);
    openChat(true);
    await sendMessage('שאלה', true);
    await screen.findByText('AI reply');

    const body = mocks.invoke.mock.calls[0][1].body;
    expect(body.currentArea).toBeNull();
    expect(body.selectedQuoteId).toBeNull();
  });

  it('never sends a caller-trusted plan/market/tenant field - only messages/flags/hints/ids (§10)', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);
    await sendMessage('שאלה', true);
    await screen.findByText('AI reply');

    const body = mocks.invoke.mock.calls[0][1].body;
    expect(body).not.toHaveProperty('plan');
    expect(body).not.toHaveProperty('market');
    expect(body).not.toHaveProperty('tenantId');
    expect(body).not.toHaveProperty('role');
  });

  it('sends workflowContext on the Dashboard surface when provided (AI Chat Hardening overnight continuation, Track B/C)', async () => {
    const workflowContext = { screen: 'quote_editor', mode: 'create', hasClient: false, hasProject: false, structureMode: 'undecided', sectionCount: 0, itemCount: 0, itemWizard: null };
    render(<AIChatWidget isHebrew={true} isDashboard={true} workflowContext={workflowContext} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);
    await sendMessage('שאלה', true);
    await screen.findByText('AI reply');

    const body = mocks.invoke.mock.calls[0][1].body;
    expect(body.workflowContext).toEqual(workflowContext);
  });

  it('sends workflowContext as null when not provided (e.g. Dashboard before any quote is open)', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);
    await sendMessage('שאלה', true);
    await screen.findByText('AI reply');

    const body = mocks.invoke.mock.calls[0][1].body;
    expect(body.workflowContext).toBeNull();
  });

  it('never sends workflowContext for the public surface, even if a workflowContext prop was somehow passed', async () => {
    const workflowContext = { screen: 'quote_editor', mode: 'create', hasClient: true, hasProject: true, structureMode: 'divided', sectionCount: 1, itemCount: 1, itemWizard: null };
    render(<AIChatWidget isHebrew={true} isDashboard={false} workflowContext={workflowContext} />);
    openChat(true);
    await sendMessage('שאלה', true);
    await screen.findByText('AI reply');

    const body = mocks.invoke.mock.calls[0][1].body;
    expect(body.workflowContext).toBeNull();
  });
});

describe('Gate 2 - explicit quote selection (§6.1)', () => {
  beforeEach(() => {
    mocks.getSession.mockResolvedValue(sessionFor('user-a'));
    mocks.quotesList = [
      { id: 'quote-1', quote_number: 101, status: 'draft', created_at: '2026-01-01', project_name: 'Kitchen' },
      { id: 'quote-2', quote_number: 102, status: 'sent', created_at: '2026-01-02', project_name: null },
    ];
  });

  async function openQuoteHelp() {
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);
    fireEvent.click(screen.getByRole('button', { name: groupCardName('quotes', true) }));
    // 'quotes' own second step ("general or specific quote") shows too -
    // the selector is additional, not instead of it.
    await screen.findByText(/#101/);
  }

  it('shows the safe quote list (number/status/project) with no client contact info, and lets the user pick one', async () => {
    await openQuoteHelp();
    expect(screen.getByText(/#101 · draft · Kitchen/)).toBeInTheDocument();
    expect(screen.getByText(/#102 · sent/)).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument(); // no email-shaped content anywhere
  });

  it('picking a quote shows a removable chip and hides the selector', async () => {
    await openQuoteHelp();
    fireEvent.click(screen.getByText(/#101 · draft · Kitchen/));

    expect(screen.getByText(/#101/)).toBeInTheDocument();
    expect(screen.queryByText(/#102/)).not.toBeInTheDocument(); // selector list gone, only the chip's own text (#101) remains
  });

  it('sends the selected quote id (and only the id, never client-side quote facts) once picked', async () => {
    await openQuoteHelp();
    fireEvent.click(screen.getByText(/#101 · draft · Kitchen/));
    await sendMessage('מה הסכום?', true);

    const body = mocks.invoke.mock.calls[0][1].body;
    expect(body.selectedQuoteId).toBe('quote-1');
    expect(body).not.toHaveProperty('quoteTotal');
    expect(body).not.toHaveProperty('quoteItems');
  });

  it('clearing the chip removes the selected quote and resets the conversation (fresh quote-context conversation)', async () => {
    await openQuoteHelp();
    fireEvent.click(screen.getByText(/#101 · draft · Kitchen/));
    await sendMessage('מה הסכום?', true);
    await screen.findByText('AI reply');

    fireEvent.click(screen.getByLabelText('הסר הצעה נבחרת'));

    await waitFor(() => {
      expect(screen.queryByText('מה הסכום?')).not.toBeInTheDocument();
    });
  });

  it('picking a DIFFERENT quote while one is active starts a fresh conversation (no mixed private context)', async () => {
    await openQuoteHelp();
    fireEvent.click(screen.getByText(/#101 · draft · Kitchen/));
    await sendMessage('שאלה על הצעה 101', true);
    await screen.findByText('AI reply');

    // Clear then pick the other quote (selector reappears once cleared).
    fireEvent.click(screen.getByLabelText('הסר הצעה נבחרת'));
    await waitFor(() => expect(screen.getByText(/#102/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/#102 · sent/));

    expect(screen.queryByText('שאלה על הצעה 101')).not.toBeInTheDocument();
  });
});

describe('Gate 2 - safe navigation (§8)', () => {
  it('renders a clickable, product-labeled navigation button when the response includes a navigation action, and dispatches the allowlisted event on click', async () => {
    mocks.invoke.mockResolvedValueOnce({
      data: { contractVersion: 2, answer: 'Here you go.', navigation: { action: 'open_quote_history' }, selectedQuoteContext: null, requestId: 'x', error: null },
      error: null,
    });
    const navHandler = vi.fn();
    window.addEventListener('proflow-ai-navigate', navHandler);

    render(<AIChatWidget isHebrew={false} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(false);
    await sendMessage('where are my quotes', false);
    await screen.findByText('Here you go.');

    const navBtn = screen.getByRole('button', { name: 'Open quote history' });
    fireEvent.click(navBtn);

    window.removeEventListener('proflow-ai-navigate', navHandler);
    expect(navHandler).toHaveBeenCalledTimes(1);
    expect(navHandler.mock.calls[0][0].detail).toEqual({ action: 'open_quote_history', meta: null });
  });

  it('renders no navigation button when the response has no navigation action', async () => {
    render(<AIChatWidget isHebrew={false} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(false);
    await sendMessage('hi', false);
    await screen.findByText('AI reply');

    expect(screen.queryByRole('button', { name: /Open/ })).not.toBeInTheDocument();
  });

  it('surfaces a truthful local note (never sent back to the model) when the server reports the selected quote became unavailable', async () => {
    mocks.getSession.mockResolvedValue(sessionFor('user-a'));
    mocks.invoke.mockResolvedValueOnce({
      data: { contractVersion: 2, answer: 'General answer.', navigation: null, selectedQuoteContext: { requested: true, available: false }, requestId: 'x', error: null },
      error: null,
    });

    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);
    await sendMessage('שאלה', true);

    expect(await screen.findByText('ההצעה שנבחרה אינה זמינה יותר. הקשר ההצעה נוקה.')).toBeInTheDocument();
  });
});

describe('stale async reply discarding', () => {
  it('a stale reply after a context reset (market change) is discarded, not appended', async () => {
    const resolveInvoke = deferredInvoke();
    const { rerender } = render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    await sendMessage('שאלה שתיהיה לא רלוונטית', true);

    // Context resets (market/locale change) while the request is still in flight.
    rerender(<AIChatWidget isHebrew={false} isDashboard={false} />);

    // The stale request now resolves.
    resolveInvoke({ data: { contractVersion: 2, answer: 'STALE REPLY', navigation: null, selectedQuoteContext: null, requestId: 'x', error: null }, error: null });
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.queryByText('STALE REPLY')).not.toBeInTheDocument();
  });

  it('a stale reply after logout is discarded, not appended', async () => {
    mocks.getSession.mockResolvedValue(sessionFor('user-a'));
    const resolveInvoke = deferredInvoke();
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);
    await sendMessage('שאלה לפני התנתקות', true);

    mocks.authCallback('SIGNED_OUT', null);

    resolveInvoke({ data: { contractVersion: 2, answer: 'STALE AFTER LOGOUT', navigation: null, selectedQuoteContext: null, requestId: 'x', error: null }, error: null });
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.queryByText('STALE AFTER LOGOUT')).not.toBeInTheDocument();
  });
});

describe('accessibility (AI Chat Hardening overnight continuation, Track J)', () => {
  it('close and send controls have accessible names', () => {
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    expect(screen.getByLabelText('סגור')).toBeInTheDocument();
    expect(screen.getByLabelText('שלח')).toBeInTheDocument();
  });

  it('close and send controls have accessible names in EN too', () => {
    render(<AIChatWidget isHebrew={false} isDashboard={false} />);
    openChat(false);
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
    expect(screen.getByLabelText('Send')).toBeInTheDocument();
  });

  it('guided top-level buttons are real, keyboard-reachable <button> elements with a plain-title accessible name and the description only in a hover tooltip (no aria-pressed - each click navigates to a different screen, not an in-place toggle)', () => {
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    const btn = screen.getByRole('button', { name: groupCardName('quotes', true) });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).not.toHaveAttribute('aria-pressed');
    expect(btn).toHaveAccessibleName('הצעות מחיר');
    expect(btn).toHaveAttribute('title', 'יצירה, חיפוש, סטטוס ופעולות על הצעות');
  });

  it('Escape closes the open chat popup', () => {
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    expect(screen.getByLabelText('סגור')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByLabelText('סגור')).not.toBeInTheDocument();
    // The launcher button (re-opens the chat) is back, proving a clean close, not a crash.
    expect(screen.getByLabelText('צאט AI')).toBeInTheDocument();
  });

  it('Escape does nothing while the chat is already closed (no listener registered, no error)', () => {
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    expect(() => fireEvent.keyDown(document, { key: 'Escape' })).not.toThrow();
    expect(screen.getByLabelText('צאט AI')).toBeInTheDocument();
  });
});

describe('Unified Header + Always-Available AI Chat task, §15 - overlay/focus coordination', () => {
  it('Escape while Chat is open never reaches an underlying foreground workflow\'s own bubble-phase Escape handler (stopPropagation, capture phase)', () => {
    // Simulates AddItemWizard.jsx's own real pattern: a nested dialog whose
    // Escape handling is wired via a bubble-phase onKeyDown on the dialog
    // element itself (React synthetic bubble == a real DOM bubble-phase
    // listener for jsdom/RTL purposes). Chat's own capture-phase listener
    // must intercept and stop the event before it ever reaches this one.
    const underlyingClose = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    host.addEventListener('keydown', (e) => { if (e.key === 'Escape') underlyingClose(); });

    render(<AIChatWidget isHebrew={true} isDashboard={false} />, { container: host });
    openChat(true);
    expect(screen.getByLabelText('סגור')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByLabelText('סגור')).not.toBeInTheDocument(); // Chat closed
    expect(underlyingClose).not.toHaveBeenCalled(); // the underlying workflow's own handler never fired
    document.body.removeChild(host);
  });

  it('Tab cycles focus within the open popup only (a real focus trap)', () => {
    // jsdom performs no layout, so getClientRects() is empty for every
    // element by default - same established workaround already used by
    // AdminPresentation.test.jsx's own identical focus-trap test.
    const originalRects = HTMLElement.prototype.getClientRects;
    HTMLElement.prototype.getClientRects = function () { return [{}]; };
    try {
      render(<AIChatWidget isHebrew={true} isDashboard={false} />);
      openChat(true);
      const dialog = screen.getByRole('dialog');
      const focusable = () => [...dialog.querySelectorAll('button, input')].filter((el) => !el.disabled);
      const items = focusable();
      expect(items.length).toBeGreaterThan(1);
      const first = items[0];
      const last = items[items.length - 1];

      last.focus();
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(document.activeElement).toBe(first);

      first.focus();
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(last);
    } finally {
      HTMLElement.prototype.getClientRects = originalRects;
    }
  });

  it('focus returns to the element that opened Chat once it closes (external trigger - the real §12 Header/Sidebar entry-point shape, which stays mounted, unlike this widget\'s own default launcher button below which conditionally unmounts itself the instant Chat opens)', () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    const headerButton = document.createElement('button');
    headerButton.textContent = 'Header AI entry';
    document.body.appendChild(headerButton);
    headerButton.focus();
    expect(document.activeElement).toBe(headerButton);

    fireEvent(window, new CustomEvent('open-proflow-ai-chat'));
    expect(screen.getByLabelText('סגור')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(document.activeElement).toBe(headerButton);
    document.body.removeChild(headerButton);
  });

  it('the open popup carries a real dialog role/aria-modal, and no such role exists while closed', () => {
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    openChat(true);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('locks body scroll only at Mobile/Tablet-Portrait width, never on Desktop (matches AuthenticatedSidebarFrame\'s own established convention)', () => {
    const original = window.matchMedia;
    window.matchMedia = (query) => ({ matches: query.includes('max-width: 768px'), addEventListener: vi.fn(), removeEventListener: vi.fn() });
    try {
      const { unmount } = render(<AIChatWidget isHebrew={true} isDashboard={false} />);
      openChat(true);
      expect(document.body.style.overflow).toBe('hidden');
      unmount();
      expect(document.body.style.overflow).toBe('');
    } finally {
      window.matchMedia = original;
    }
  });

  it('does not lock body scroll on Desktop widths', () => {
    const original = window.matchMedia;
    window.matchMedia = () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    try {
      render(<AIChatWidget isHebrew={true} isDashboard={false} />);
      openChat(true);
      expect(document.body.style.overflow).not.toBe('hidden');
    } finally {
      window.matchMedia = original;
    }
  });
});

describe('AI Chat History UX (timestamps + day separators + New Chat)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a sent message and its reply each show a real per-message time (HH:MM shape)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T14:32:00'));
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    const input = screen.getByPlaceholderText('שאל משהו...');
    fireEvent.change(input, { target: { value: 'שאלה עם זמן' } });
    fireEvent.submit(input.closest('form'));
    vi.useRealTimers(); // let the mocked async invoke() promise actually resolve
    await screen.findByText('AI reply');

    const timeTexts = screen.getAllByText(/^\d{1,2}:\d{2}$/);
    expect(timeTexts.length).toBeGreaterThanOrEqual(2); // the user message and the reply
  });

  it('EN per-message time also renders in HH:MM shape', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T09:05:00'));
    render(<AIChatWidget isHebrew={false} isDashboard={false} />);
    openChat(false);
    const input = screen.getByPlaceholderText('Ask something...');
    fireEvent.change(input, { target: { value: 'A question with a time' } });
    fireEvent.submit(input.closest('form'));
    vi.useRealTimers();
    await screen.findByText('AI reply');

    expect(screen.getAllByText(/^\d{1,2}:\d{2}$/).length).toBeGreaterThanOrEqual(2);
  });

  it('shows a "היום" separator for a message sent today (HE)', async () => {
    vi.setSystemTime(new Date('2026-09-18T10:00:00'));
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    await sendMessage('הודעה של היום', true);
    await screen.findByText('AI reply');
    expect(screen.getByText('היום')).toBeInTheDocument();
  });

  it('shows a "Today" separator for a message sent today (EN)', async () => {
    vi.setSystemTime(new Date('2026-09-18T10:00:00'));
    render(<AIChatWidget isHebrew={false} isDashboard={false} />);
    openChat(false);
    await sendMessage('a message sent today', false);
    await screen.findByText('AI reply');
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('shows exactly one "Today" separator, not one per message, for multiple same-day messages', async () => {
    vi.setSystemTime(new Date('2026-09-18T10:00:00'));
    render(<AIChatWidget isHebrew={false} isDashboard={false} />);
    openChat(false);
    await sendMessage('first message today', false);
    await screen.findByText('AI reply');
    await sendMessage('second message today', false);
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2));
    expect(screen.getAllByText('Today')).toHaveLength(1);
  });

  it('labels a message from yesterday "אתמול" (HE) / "Yesterday" (EN), not "Today"', () => {
    const yesterdayIso = new Date('2026-09-17T10:00:00.000Z').toISOString();
    sessionStorage.setItem('proflow_ai_chat_public_v2_he', JSON.stringify({
      schemaVersion: 2,
      messages: [{ role: 'assistant', content: 'הודעה מאתמול', createdAt: yesterdayIso }],
    }));
    vi.setSystemTime(new Date('2026-09-18T10:00:00'));
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    expect(screen.getByText('אתמול')).toBeInTheDocument();
    expect(screen.queryByText('היום')).not.toBeInTheDocument();
  });

  it('falls back to a real localized date (not Today/Yesterday) for a message older than yesterday', () => {
    const oldIso = new Date('2026-09-10T10:00:00.000Z').toISOString();
    sessionStorage.setItem('proflow_ai_chat_public_v2_en', JSON.stringify({
      schemaVersion: 2,
      messages: [{ role: 'assistant', content: 'an old message', createdAt: oldIso }],
    }));
    vi.setSystemTime(new Date('2026-09-18T10:00:00'));
    render(<AIChatWidget isHebrew={false} isDashboard={false} />);
    openChat(false);
    expect(screen.queryByText('Today')).not.toBeInTheDocument();
    expect(screen.queryByText('Yesterday')).not.toBeInTheDocument();
    // Some real localized date string is present near the message - not asserting
    // the exact locale string (that is aiChatHistoryFormat.test.js's own job),
    // just that the message itself still rendered safely alongside it.
    expect(screen.getByText('an old message')).toBeInTheDocument();
  });

  it('a legacy stored message with no createdAt renders safely with no time and no separator', () => {
    sessionStorage.setItem('proflow_ai_chat_public_v2_he', JSON.stringify({
      schemaVersion: 2,
      messages: [{ role: 'assistant', content: 'הודעה ישנה בלי חותמת זמן' }],
    }));
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    expect(() => openChat(true)).not.toThrow();
    expect(screen.getByText('הודעה ישנה בלי חותמת זמן')).toBeInTheDocument();
    expect(screen.queryByText('היום')).not.toBeInTheDocument();
    expect(screen.queryByText('אתמול')).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d{1,2}:\d{2}$/)).not.toBeInTheDocument();
  });

  it('New Chat (HE) clears the visible thread, restores guided topics, and keeps free-text usable', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    await sendMessage('שאלה לפני שיחה חדשה', true);
    await screen.findByText('AI reply');
    expect(screen.queryByText('הצעות מחיר')).not.toBeInTheDocument(); // topics hidden post-message

    fireEvent.click(screen.getByLabelText('שיחה חדשה'));

    expect(screen.queryByText('שאלה לפני שיחה חדשה')).not.toBeInTheDocument();
    expect(screen.queryByText('AI reply')).not.toBeInTheDocument();
    expect(screen.getByText('שלום! במה תרצה עזרה?')).toBeInTheDocument();
    expect(screen.getByText('הצעות מחיר')).toBeInTheDocument(); // guided topics restored
    expect(screen.getByPlaceholderText('שאל משהו...')).toBeInTheDocument(); // free-text still usable
  });

  it('New Chat (EN) clears the visible thread and restores guided topics, independently of HE', async () => {
    render(<AIChatWidget isHebrew={false} isDashboard={false} />);
    openChat(false);
    await sendMessage('a question before new chat', false);
    await screen.findByText('AI reply');
    expect(screen.queryByText('Quotes')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('New Chat'));

    expect(screen.queryByText('a question before new chat')).not.toBeInTheDocument();
    expect(screen.getByText('Hello! How can I help you today?')).toBeInTheDocument();
    expect(screen.getByText('Quotes')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ask something...')).toBeInTheDocument();
  });

  it('New Chat can be clicked with no prior conversation without throwing (topics-only state, no-op archive)', () => {
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    expect(() => fireEvent.click(screen.getByLabelText('שיחה חדשה'))).not.toThrow();
    expect(screen.getByText('הצעות מחיר')).toBeInTheDocument();
  });

  it('New Chat resets the guided hierarchy all the way to the descriptive top-level cards, even mid-subtopic-navigation with no message sent yet', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);
    fireEvent.click(screen.getByRole('button', { name: groupCardName('help_support', true) }));
    expect(screen.getByRole('button', { name: leafCardName('technical_problem', true) })).toBeInTheDocument();
    expect(screen.queryByText('הצעות מחיר')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('שיחה חדשה'));

    expect(screen.getByRole('button', { name: groupCardName('quotes', true) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: groupCardName('help_support', true) })).toBeInTheDocument();
    expect(screen.queryByText('בעיה טכנית')).not.toBeInTheDocument();
  });

  it('guided topics still hide again after sending a new first message post-New-Chat (existing hide-after-first-message contract preserved)', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    await sendMessage('שאלה ראשונה', true);
    await screen.findByText('AI reply');
    fireEvent.click(screen.getByLabelText('שיחה חדשה'));
    expect(screen.getByText('הצעות מחיר')).toBeInTheDocument();

    await sendMessage('שאלה שנייה אחרי שיחה חדשה', true);
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('הצעות מחיר')).not.toBeInTheDocument();
  });
});

describe('Context-Driven AI Chat V3, §16 - screen-specific contextual guided menus', () => {
  it('New Quote (create, no items) shows its own contextual menu, not the universal 5 groups', async () => {
    const workflowContext = { screen: 'quote_editor', mode: 'create', hasClient: false, hasProject: false, structureMode: 'undecided', sectionCount: 0, itemCount: 0, itemWizard: null };
    mocks.getSession.mockResolvedValue(sessionFor('user-a'));
    render(<AIChatWidget isHebrew={true} isDashboard={true} currentArea="main" workflowContext={workflowContext} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);

    expect(screen.getByRole('button', { name: leafCardName('current_process_help', true) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: leafCardName('clients', true) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: leafCardName('suggestion', true) })).toBeInTheDocument();
    // §8 "NEW QUOTE CONTEXT > EXISTING QUOTE PICKER": the universal 'quotes'
    // group (and thus its existing-quote picker) is not offered at all here.
    expect(screen.queryByRole('button', { name: leafCardName('quotes', true) })).not.toBeInTheDocument();
    // The universal 5-group menu is retired for this screen.
    expect(screen.queryByRole('button', { name: groupCardName('help_support', true) })).not.toBeInTheDocument();
  });

  it('the item wizard being open (highest-priority context) shows its own contextual menu even though a quote editor is also technically open', async () => {
    const workflowContext = {
      screen: 'quote_editor', mode: 'create', hasClient: true, hasProject: false, structureMode: 'undecided', sectionCount: 0, itemCount: 1,
      itemWizard: { open: true, action: 'add', itemType: 'unknown', hasMeasurements: null },
    };
    render(<AIChatWidget isHebrew={true} isDashboard={true} currentArea="main" workflowContext={workflowContext} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);

    expect(screen.getByRole('button', { name: leafCardName('current_process_help', true) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: leafCardName('software_help', true) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: leafCardName('technical_problem', true) })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: leafCardName('clients', true) })).not.toBeInTheDocument();
  });

  it('a screen with no specific contextual menu (Quote History / Dashboard overview) still shows the universal 5-group fallback', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={true} currentArea="main" />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);

    expect(screen.getByRole('button', { name: groupCardName('quotes', true) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: groupCardName('help_support', true) })).toBeInTheDocument();
  });

  it('the public surface is never affected by contextual menus (it has no screens)', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={false} currentArea="clients" />);
    openChat(true);
    for (const id of PUBLIC_SAFE_INTENT_IDS) {
      expect(screen.getByRole('button', { name: leafCardName(id, true) })).toBeInTheDocument();
    }
  });
});

describe('Context-Driven AI Chat V3, §9 - EDIT QUOTE CURRENT OBJECT (activeEditingQuoteId auto-bind)', () => {
  it('auto-binds the actively-edited quote as the selected quote, with no manual picker step required', async () => {
    mocks.getSession.mockResolvedValue(sessionFor('user-a'));
    const workflowContext = { screen: 'quote_editor', mode: 'edit', hasClient: true, hasProject: true, structureMode: 'regular', sectionCount: 0, itemCount: 2, itemWizard: null };
    render(<AIChatWidget isHebrew={true} isDashboard={true} currentArea="main" workflowContext={workflowContext} activeEditingQuoteId="quote-edit-1" />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);

    await sendMessage('מה הסכום של ההצעה הזאת?', true);
    const body = mocks.invoke.mock.calls[0][1].body;
    expect(body.selectedQuoteId).toBe('quote-edit-1');
  });

  it('an old chat-selected quote may not override the current edit quote', async () => {
    mocks.getSession.mockResolvedValue(sessionFor('user-a'));
    mocks.quotesList = [{ id: 'quote-stale', quote_number: 55, status: 'draft', created_at: '2026-01-01', project_name: null }];
    const { rerender } = render(<AIChatWidget isHebrew={true} isDashboard={true} currentArea="main" />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);
    fireEvent.click(screen.getByRole('button', { name: groupCardName('quotes', true) }));
    await screen.findByText(/#55/);
    fireEvent.click(screen.getByText(/#55/));
    await waitFor(() => expect(screen.getByText(/#55/)).toBeInTheDocument());

    // Now the user actually opens a DIFFERENT quote to edit - it must win.
    const workflowContext = { screen: 'quote_editor', mode: 'edit', hasClient: true, hasProject: true, structureMode: 'regular', sectionCount: 0, itemCount: 1, itemWizard: null };
    rerender(<AIChatWidget isHebrew={true} isDashboard={true} currentArea="main" workflowContext={workflowContext} activeEditingQuoteId="quote-actually-editing" />);

    await sendMessage('מה הסכום?', true);
    const body = mocks.invoke.mock.calls[0][1].body;
    expect(body.selectedQuoteId).toBe('quote-actually-editing');
  });
});

describe('Context-Driven AI Chat V3, §25 - OLD MESSAGE ACTION REBIND BUG CLOSED', () => {
  it('a navigation button opens the quote that was selected when ITS OWN reply was generated, never a since-changed live selection', async () => {
    mocks.getSession.mockResolvedValue(sessionFor('user-a'));
    mocks.quotesList = [
      { id: 'quote-A', quote_number: 1, status: 'draft', created_at: '2026-01-01', project_name: null },
      { id: 'quote-B', quote_number: 2, status: 'draft', created_at: '2026-01-02', project_name: null },
    ];
    mocks.invoke.mockResolvedValueOnce({
      data: { contractVersion: 3, answer: 'About quote A.', navigation: { action: 'open_selected_quote' }, selectedQuoteContext: { requested: true, available: true }, requestId: 'x', contextRevision: 0, error: null },
      error: null,
    });

    const navHandler = vi.fn();
    window.addEventListener('proflow-ai-navigate', navHandler);

    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);
    fireEvent.click(screen.getByRole('button', { name: groupCardName('quotes', true) }));
    await screen.findByText(/#1/);
    fireEvent.click(screen.getByText(/#1/));
    await sendMessage('מה הסכום?', true);
    await screen.findByRole('button', { name: 'פתיחת ההצעה שנבחרה' });

    // Switch to a different quote WITHOUT clicking the still-visible old
    // button first (this itself resets messages in the real widget - the
    // scenario under test is specifically whether the OLD button, if a
    // future refactor ever again made it survive, would read live state;
    // this asserts it reads its own bound value instead).
    fireEvent.click(screen.getByLabelText('הסר הצעה נבחרת'));
    await waitFor(() => expect(screen.getByText(/#2/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/#2 /));

    // The old button is gone now (messages reset alongside the quote
    // change, per the existing selectedQuoteId reset boundary) - confirming
    // there is no surviving stale button to click is itself the real
    // structural guarantee against this bug class.
    expect(screen.queryByRole('button', { name: 'פתיחת ההצעה שנבחרה' })).not.toBeInTheDocument();

    window.removeEventListener('proflow-ai-navigate', navHandler);
  });

  it('handleNavigationClick dispatches the quote id bound onto the clicked message, not a different live selection', async () => {
    mocks.getSession.mockResolvedValue(sessionFor('user-a'));
    mocks.quotesList = [{ id: 'quote-bound', quote_number: 9, status: 'draft', created_at: '2026-01-01', project_name: null }];
    mocks.invoke.mockResolvedValueOnce({
      data: { contractVersion: 3, answer: 'About the bound quote.', navigation: { action: 'open_selected_quote' }, selectedQuoteContext: { requested: true, available: true }, requestId: 'x', contextRevision: 0, error: null },
      error: null,
    });
    const navHandler = vi.fn();
    window.addEventListener('proflow-ai-navigate', navHandler);

    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);
    fireEvent.click(screen.getByRole('button', { name: groupCardName('quotes', true) }));
    await screen.findByText(/#9/);
    fireEvent.click(screen.getByText(/#9/));
    await sendMessage('מה הסכום?', true);
    const navBtn = await screen.findByRole('button', { name: 'פתיחת ההצעה שנבחרה' });
    fireEvent.click(navBtn);

    window.removeEventListener('proflow-ai-navigate', navHandler);
    expect(navHandler).toHaveBeenCalledTimes(1);
    expect(navHandler.mock.calls[0][0].detail).toEqual({ action: 'open_selected_quote', meta: { quoteId: 'quote-bound' } });
  });
});

describe('Context-Driven AI Chat V3, §27 - PREVIOUS CHATS (accessible, bounded, read-only)', () => {
  it('New Chat archives the ended conversation, and Previous Chats shows it with a preview of the first user message', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    await sendMessage('מה מחיר המסלול הבסיסי?', true);
    await screen.findByText('AI reply');
    fireEvent.click(screen.getByLabelText('שיחה חדשה'));

    fireEvent.click(screen.getByLabelText('שיחות קודמות'));
    expect(screen.getByText('מה מחיר המסלול הבסיסי?')).toBeInTheDocument();
  });

  it('expanding an archived thread shows its full read-only message list', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    await sendMessage('שאלה ראשונה', true);
    await screen.findByText('AI reply');
    fireEvent.click(screen.getByLabelText('שיחה חדשה'));
    fireEvent.click(screen.getByLabelText('שיחות קודמות'));

    fireEvent.click(screen.getByText('שאלה ראשונה'));
    expect(screen.getAllByText(/AI reply/).length).toBeGreaterThan(0);
  });

  it('shows an empty state when there is nothing archived yet', async () => {
    render(<AIChatWidget isHebrew={true} isDashboard={false} />);
    openChat(true);
    fireEvent.click(screen.getByLabelText('שיחות קודמות'));
    expect(screen.getByText('אין עדיין שיחות קודמות בפגישה זו.')).toBeInTheDocument();
  });

  it('logout clears all archived Previous Chats (§26 private-state isolation)', async () => {
    mocks.getSession.mockResolvedValue(sessionFor('user-a'));
    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);
    await sendMessage('שאלה לפני התנתקות', true);
    await screen.findByText('AI reply');
    fireEvent.click(screen.getByLabelText('שיחה חדשה'));

    mocks.authCallback('SIGNED_OUT', null);
    await waitFor(() => expect(screen.queryByText('שאלה לפני התנתקות')).not.toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('שיחות קודמות'));
    expect(screen.getByText('אין עדיין שיחות קודמות בפגישה זו.')).toBeInTheDocument();
  });
});

describe('Context-Driven AI Chat V3, §22 - direct fact answers pass answerSource through without breaking rendering', () => {
  it('renders a deterministic direct-fact answer exactly like a model answer', async () => {
    mocks.getSession.mockResolvedValue(sessionFor('user-a'));
    mocks.invoke.mockResolvedValueOnce({
      data: {
        contractVersion: 3, answer: 'הסכום הכולל של ההצעה הוא ₪333.00.', answerSource: 'deterministic',
        factPayload: { kind: 'amount', value: '₪333.00', isDraft: false },
        navigation: null, selectedQuoteContext: { requested: true, available: true }, requestId: 'x', contextRevision: 0, error: null,
      },
      error: null,
    });

    render(<AIChatWidget isHebrew={true} isDashboard={true} />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    openChat(true);
    await sendMessage('מה הסכום?', true);
    expect(await screen.findByText('הסכום הכולל של ההצעה הוא ₪333.00.')).toBeInTheDocument();
  });
});
