// Codex release 5 (Owner console 2026-10-29 night, decisions 7 + 8, L-22; L-25 dates / dialog unchanged): the grey colour, the reply ban
// on the screen, one row per conversation, the conversation timeline and the Owner-only link. SYNTHETIC rows; the server is a fake.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import AdminInquiries from './AdminInquiries';
import { focusInquiry } from '../utils/adminInquiryFocus';

const mocks = vi.hoisted(() => ({ result: { data: [], error: null }, invokes: [], invokeResult: null }));
vi.mock('../shared/supabase', () => ({
  supabase: {
    from: () => {
      const q = { select() { return q; }, order() { return q; }, eq() { return q; }, limit() { return Promise.resolve(mocks.result); },
        maybeSingle() { return Promise.resolve({ data: { auto_send_green: false, auto_send_yellow: false, paused: false }, error: null }); },
        in() { return Promise.resolve({ count: 0, error: null }); } };
      for (const verb of ['insert', 'update', 'upsert', 'delete']) q[verb] = () => { throw new Error(`write ${verb}`); };
      return q;
    },
    functions: { invoke: async (name, { body }) => { mocks.invokes.push({ name, body }); return { data: typeof mocks.invokeResult === 'function' ? mocks.invokeResult(body) : mocks.invokeResult, error: null }; } },
  },
}));
afterEach(() => { cleanup(); mocks.invokes = []; mocks.invokeResult = null; });

const BASE = { from_name: null, to_addresses: ['support@inbound.tekango.test'], attachments: [], auth_results: null, mailbox: 'support', reply_language: 'he', automation_class: 'human', reply_allowed: true };
const GREY = { ...BASE, id: 'g1', status: 'waiting', bin: 'grey', bin_reason: 'possible_automatic', from_address: 'info.noreply@bank.test', subject: 'הודעת פרטיות', text_body: 'Privacy notice', received_at: '2026-10-30T07:00:00Z', automation_class: 'possible_automatic', reply_allowed: false };
const FIRST = { ...BASE, id: 'c1', status: 'answered', bin: 'green', from_address: 'dana@customer.test', subject: 'לוגו', text_body: 'איך מוסיפים לוגו?', received_at: '2026-10-30T08:00:00Z', conversation_id: 'conv-1', association: 'new' };
const FOLLOW = { ...BASE, id: 'c2', status: 'waiting', bin: 'red', bin_reason: 'word:החזר', from_address: 'dana@customer.test', subject: 'Re: לוגו', text_body: 'ואני רוצה החזר', received_at: '2026-10-30T09:00:00Z', conversation_id: 'conv-1', association: 'reference' };
const SUGGESTED = { ...BASE, id: 's1', status: 'waiting', bin: 'red', bin_reason: 'word:תשלום', from_address: 'dana@customer.test', subject: 'תשלום', text_body: 'שאלה על תשלום', received_at: '2026-10-30T10:00:00Z', conversation_id: 'conv-2', association: 'suggested', suggested_conversation_id: '44444444-4444-4444-8444-444444444444' };
const THREAD = {
  ok: true, truncated: false, conversation: { id: 'conv-1' },
  messages: [FIRST, FOLLOW],
  outbound: [
    { id: 'o1', kind: 'ack', state: 'sent', body_known: false, body_text: null, created_at: '2026-10-30T08:00:30Z' },
    { id: 'o2', kind: 'assistant', state: 'unknown', body_known: true, body_text: 'שלום,\nבהגדרות העסק.', created_at: '2026-10-30T08:05:00Z' },
  ],
};

describe('decision 7: grey and the reply ban on the screen', () => {
  it.each([[true], [false]])('isHebrew=%s: grey is a colour of its own; a grey email says why and offers no reply - only "do not send"', async (isHebrew) => {
    mocks.result = { data: [GREY], error: null };
    render(<AdminInquiries isHebrew={isHebrew} />);
    const options = within(screen.getByTestId('inquiries-bin-filter')).getAllByRole('option').map((o) => o.value);
    expect(options).toContain('grey');
    fireEvent.click(await screen.findByTestId('inquiry-row'));
    expect(screen.getByTestId('inquiry-grey').textContent).toBe(isHebrew ? 'ייתכן שזו הודעה אוטומטית. היא נשמרה לבדיקה ולא נשלחה תשובה לשולח.' : 'This may be an automated message. It was kept for review and no reply was sent.');
    expect(screen.getByTestId('inquiry-no-reply').textContent).toBe(isHebrew ? 'הכתובת הזו אינה מיועדת למענה. בדקו את ההודעה לפני יצירת קשר בדרך אחרת.' : 'This address is not intended for replies. Review the message before contacting the sender another way.');
    expect(screen.queryByTestId('inquiry-reply')).toBeNull();
    expect(screen.queryByTestId('inquiry-send')).toBeNull();
    expect(screen.getByTestId('inquiry-dismiss')).toBeTruthy();
  });
  it('a red email whose reply is banned (a forged-header request kept visible) shows no reply either', async () => {
    mocks.result = { data: [{ ...FOLLOW, conversation_id: null, reply_allowed: false, automation_class: 'possible_automatic' }], error: null };
    render(<AdminInquiries isHebrew />);
    fireEvent.click(await screen.findByTestId('inquiry-row'));
    expect(screen.getByTestId('inquiry-no-reply')).toBeTruthy();
    expect(screen.queryByTestId('inquiry-reply-text')).toBeNull();
  });
});

describe('decision 8: conversations on the screen', () => {
  it('one row per conversation (its waiting red message), with the number of messages', async () => {
    mocks.result = { data: [FOLLOW, FIRST, GREY], error: null };
    render(<AdminInquiries isHebrew />);
    const rows = await screen.findAllByTestId('inquiry-row');
    expect(rows).toHaveLength(2);
    expect(screen.getAllByTestId('inquiry-subject').map((s) => s.textContent)).toContain('Re: לוגו · שיחה: 2 הודעות');
    cleanup();
    render(<AdminInquiries isHebrew={false} />);
    await screen.findAllByTestId('inquiry-row');
    expect(screen.getAllByTestId('inquiry-subject').map((s) => s.textContent)).toContain('Re: לוגו · Conversation: 2 messages');
  });
  it.each([[true], [false]])('isHebrew=%s: the dialog shows the timeline - received, the acknowledgement (text not kept) and a reply whose delivery is not confirmed', async (isHebrew) => {
    mocks.result = { data: [FOLLOW, FIRST], error: null };
    mocks.invokeResult = (body) => (body.action === 'conversation' ? THREAD : { ok: false });
    render(<AdminInquiries isHebrew={isHebrew} />);
    fireEvent.click(await screen.findByTestId('inquiry-row'));
    await screen.findAllByTestId('thread-in');
    expect(mocks.invokes[0]).toEqual({ name: 'support-admin', body: { action: 'conversation', id: 'c2' } });
    expect(screen.getAllByTestId('thread-in')).toHaveLength(2);
    const states = screen.getAllByTestId('thread-out-state').map((s) => s.textContent);
    expect(states).toEqual(isHebrew ? ['נשלח', 'השליחה לא אומתה'] : ['Sent', 'Delivery not confirmed']);
    expect(screen.getByTestId('inquiry-thread').textContent).toContain(isHebrew ? 'הנוסח המדויק לא נשמר.' : 'The exact text was not kept.');
    expect(screen.getByTestId('inquiry-thread').textContent).toContain(isHebrew ? 'ההודעה הפתוחה' : 'The open message');
    // the other message opens in the same dialog
    fireEvent.click(screen.getByTestId('thread-view-original'));
    expect(screen.getByTestId('thread-view-original')).toBeTruthy();
    expect(within(screen.getByTestId('inquiry-detail')).getAllByText(isHebrew ? 'איך מוסיפים לוגו?' : 'איך מוסיפים לוגו?').length).toBeGreaterThan(0);
  });
  it('a subject-only match is a suggestion; only the Owner (canLink) gets the link button, which goes through support-admin', async () => {
    mocks.result = { data: [SUGGESTED], error: null };
    mocks.invokeResult = (body) => (body.action === 'conversation' ? { ok: true, conversation: { id: 'conv-2' }, messages: [SUGGESTED], outbound: [] } : { ok: true, conversation_id: '44444444-4444-4444-8444-444444444444' });
    render(<AdminInquiries isHebrew />);
    fireEvent.click(await screen.findByTestId('inquiry-row'));
    expect(screen.getByTestId('inquiry-suggested').textContent).toContain('ייתכן שההודעה קשורה לשיחה קיימת. היא לא אוחדה אוטומטית.');
    expect(screen.queryByTestId('inquiry-link')).toBeNull();
    cleanup();
    render(<AdminInquiries isHebrew={false} canLink />);
    fireEvent.click(await screen.findByTestId('inquiry-row'));
    expect(screen.getByTestId('inquiry-suggested').textContent).toContain('This message may belong to an existing conversation. It was not merged automatically.');
    fireEvent.click(screen.getByTestId('inquiry-link'));
    await waitFor(() => expect(mocks.invokes.some((i) => i.body.action === 'link' && i.body.target === '44444444-4444-4444-8444-444444444444' && i.body.id === 's1')).toBe(true));
  });
  it('an old deep link still opens that exact message, inside its conversation', async () => {
    mocks.result = { data: [FOLLOW, FIRST], error: null };
    mocks.invokeResult = THREAD;
    focusInquiry('c1');
    render(<AdminInquiries isHebrew />);
    await screen.findByTestId('inquiry-detail');
    expect(mocks.invokes[0].body).toEqual({ action: 'conversation', id: 'c1' });
    await screen.findAllByTestId('thread-in');
    expect(screen.getAllByTestId('thread-in').find((li) => li.getAttribute('aria-current') === 'true').textContent).toContain('איך מוסיפים לוגו?');
  });
});
