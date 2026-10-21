// Owner console 2026-10-19, typed: "מאשר שינוי ב-L-22: לשונית "פניות" חדשה בממשק הניהול" - the smart support email stage 1;
// Owner console 2026-10-20, typed: "מאשר שינוי ב-L-22: שלב 2 של המייל החכם (צבעים, מונה, טיוטות, שבוע ניסיון ועמודת הכתובת)" - stage 2.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import AdminInquiries from './AdminInquiries';
import AdminSidebarNav from './AdminSidebarNav';
import { ADMIN_DESTINATIONS } from './adminDestinations';

const mocks = vi.hoisted(() => ({ result: { data: [], error: null }, settings: { auto_send_green: false, auto_send_yellow: false, paused: false }, calls: [], invokes: [], invokeResult: null, count: 0 }));
vi.mock('../shared/supabase', () => ({
  supabase: {
    from: (table) => {
      const q = { table, select(cols, opts) { q.cols = cols; q.opts = opts; return q; }, order() { return q; }, eq() { return q; },
        limit() { mocks.calls.push(q); return Promise.resolve(mocks.result); },
        maybeSingle() { mocks.calls.push(q); return Promise.resolve({ data: mocks.settings, error: null }); },
        in() { mocks.calls.push(q); return Promise.resolve({ count: mocks.count, error: null }); } };
      for (const verb of ['insert', 'update', 'upsert', 'delete']) q[verb] = () => { throw new Error(`write ${verb}`); };
      return q;
    },
    functions: { invoke: async (name, { body }) => { mocks.invokes.push({ name, body }); return { data: typeof mocks.invokeResult === 'function' ? mocks.invokeResult(body) : mocks.invokeResult, error: null }; } },
  },
}));
afterEach(() => { cleanup(); mocks.calls = []; mocks.invokes = []; mocks.invokeResult = null; });

const ROW = { id: 'r1', status: 'new', bin: null, from_address: 'noa@customer.test', from_name: 'Noa Cohen', to_addresses: ['support@inbound.tekango.test'], subject: 'איך מוסיפים לוגו?', text_body: 'שלום,\nאיך מוסיפים לוגו להצעה?', attachments: [{ filename: 'shot.png' }], auth_results: { spf: 'pass', dkim: 'pass', dmarc: 'fail' }, received_at: '2026-10-19T18:00:00Z' };
const DRAFT = { ...ROW, id: 'r2', status: 'draft', bin: 'green', bin_reason: 'model:green', summary: 'רוצה להוסיף לוגו', mailbox: 'info', reply_language: 'he', draft_reply: 'שלום,\nבהגדרות העסק.' };
const RED = { ...ROW, id: 'r3', status: 'waiting', bin: 'red', bin_reason: 'word:ביטול', mailbox: 'support', reply_language: 'he', draft_reply: null, ack_sent_at: '2026-10-20T08:00:00Z', subject: 'ביטול' };
const DONE = { ...ROW, id: 'r4', status: 'answered', bin: 'green', mailbox: 'support', reply_text: 'שלום, הנה התשובה', reply_sent_at: '2026-10-20T09:00:00Z', reply_sent_by: 'assistant', subject: 'נענתה' };

describe('Admin "Inquiries" tab (Owner 2026-10-19, L-22)', () => {
  // Owner console 2026-10-20 (L-22 "צמצום תפריט הניהול לשני כפתורים ומסך מרכזי, ומשתמש מפקח ..."): inside the "ניהול" hub, opened by inquiries.view
  it('is one registry destination in the "ניהול" hub, opened by inquiries.view, phone "More" list', () => {
    const d = ADMIN_DESTINATIONS.find((x) => x.id === 'inquiries');
    expect(d).toMatchObject({ hub: 'manage', permission: 'inquiries.view', mobile: 'more', available: true, label: { he: 'פניות', en: 'Inquiries' } });
  });

  it('lists the received inquiries (reads only); a row opens the full text, the attachments (names only) and the sender checks', async () => {
    mocks.result = { data: [ROW], error: null };
    render(<AdminInquiries isHebrew />);
    const rows = await screen.findAllByTestId('inquiry-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('איך מוסיפים לוגו?');
    expect(mocks.calls[0].table).toBe('support_inbound_messages');
    fireEvent.click(rows[0]);
    const dlg = screen.getByTestId('inquiry-detail');
    expect(dlg.textContent).toContain('איך מוסיפים לוגו להצעה?');
    expect(dlg.textContent).toContain('shot.png');
    expect(dlg.textContent).toContain('DMARC fail');
  });

  it('search narrows the list; the empty state says receiving starts after the address is connected (HE / EN)', async () => {
    mocks.result = { data: [ROW], error: null };
    render(<AdminInquiries isHebrew />);
    await screen.findAllByTestId('inquiry-row');
    fireEvent.change(screen.getByTestId('inquiries-search'), { target: { value: 'חשבונית' } });
    expect(screen.getByTestId('inquiries-empty').textContent).toBe('אין פניות תואמות לחיפוש.');
    cleanup();
    mocks.result = { data: [], error: null };
    render(<AdminInquiries isHebrew={false} />);
    await waitFor(() => expect(screen.getByTestId('inquiries-empty').textContent).toBe('No inquiries yet. Receiving starts once the support address is connected.'));
  });
});

describe('stage 2 (Owner 2026-10-20, L-22): colours, state, mailbox column, counter, drafts and settings', () => {
  it('every row shows its colour, the mailbox it was sent to and its state; the counter = waiting + drafts; the filter narrows to them', async () => {
    mocks.result = { data: [DRAFT, RED, DONE], error: null };
    render(<AdminInquiries isHebrew />);
    const rows = await screen.findAllByTestId('inquiry-row');
    expect(rows.map((r) => within(r).getByTestId('inquiry-mailbox').textContent)).toEqual(['info@tekango.com', 'support@tekango.com', 'support@tekango.com']);
    expect(within(rows[1]).getByRole('img', { name: 'אדום' })).toBeTruthy();
    expect(rows[0].textContent).toContain('טיוטה לאישור');
    expect(rows[1].textContent).toContain('ממתינה לטיפולכם');
    expect(rows[2].textContent).toContain('נענתה');
    expect(screen.getByTestId('inquiries-pending').textContent).toBe('2');
    expect(screen.getByText('פניות: 3 · ממתינות לטיפול: 2')).toBeTruthy();
    fireEvent.change(screen.getByTestId('inquiries-filter'), { target: { value: 'pending' } });
    expect(screen.getAllByTestId('inquiry-row')).toHaveLength(2);
  });

  it('a draft: "מאשר ושולח" sends the draft as is; editing turns it into "מתקן ושולח"; every action goes through support-admin', async () => {
    mocks.result = { data: [DRAFT], error: null };
    mocks.invokeResult = { ok: true, status: 'answered' };
    render(<AdminInquiries isHebrew />);
    fireEvent.click((await screen.findAllByTestId('inquiry-row'))[0]);
    const dlg = screen.getByTestId('inquiry-detail');
    expect(dlg.textContent).toContain('שאלה שהעוזר יודע לענות עליה');
    expect(dlg.textContent).toContain('רוצה להוסיף לוגו');
    expect(screen.getByTestId('inquiry-reply-text').value).toBe('שלום,\nבהגדרות העסק.');
    expect(screen.getByTestId('inquiry-reply-text').getAttribute('dir')).toBe('rtl');
    expect(screen.getByTestId('inquiry-send').textContent).toContain('מאשר ושולח');
    fireEvent.change(screen.getByTestId('inquiry-reply-text'), { target: { value: 'שלום,\nתשובה מתוקנת.' } });
    expect(screen.getByTestId('inquiry-send').textContent).toContain('מתקן ושולח');
    fireEvent.click(screen.getByTestId('inquiry-send'));
    await waitFor(() => expect(screen.getByTestId('inquiry-notice').textContent).toBe('נשלח ללקוח.'));
    expect(mocks.invokes[0]).toEqual({ name: 'support-admin', body: { action: 'send', id: 'r2', text: 'שלום,\nתשובה מתוקנת.' } });
    expect(screen.queryByTestId('inquiry-reply')).toBeNull();
  });

  it('a RED inquiry shows why and the acknowledgement already sent; "בקשת טיוטה מהעוזר" fills the reply; "לא לשלוח" closes it', async () => {
    mocks.result = { data: [RED], error: null };
    mocks.invokeResult = (body) => (body.action === 'redraft' ? { ok: true, draft: 'שלום,\nטיוטה מהעוזר.' } : { ok: true, status: 'dismissed' });
    render(<AdminInquiries isHebrew />);
    fireEvent.click((await screen.findAllByTestId('inquiry-row'))[0]);
    const dlg = screen.getByTestId('inquiry-detail');
    expect(dlg.textContent).toContain('המילה "ביטול"');
    expect(dlg.textContent).toContain('אישור קבלה קבוע נשלח');
    expect(screen.getByTestId('inquiry-send').textContent).toContain('שליחה');
    fireEvent.click(screen.getByTestId('inquiry-redraft'));
    await waitFor(() => expect(screen.getByTestId('inquiry-reply-text').value).toBe('שלום,\nטיוטה מהעוזר.'));
    fireEvent.click(screen.getByTestId('inquiry-dismiss'));
    await waitFor(() => expect(screen.getByTestId('inquiry-notice').textContent).toBe('הפנייה סומנה: לא לשלוח.'));
    expect(mocks.invokes.map((c) => c.body.action)).toEqual(['redraft', 'dismiss']);
  });

  it('an answered inquiry shows what was sent and offers no actions (EN)', async () => {
    mocks.result = { data: [DONE], error: null };
    render(<AdminInquiries isHebrew={false} />);
    fireEvent.click((await screen.findAllByTestId('inquiry-row'))[0]);
    expect(screen.getByTestId('inquiry-detail').textContent).toContain('by the assistant');
    expect(screen.queryByTestId('inquiry-reply')).toBeNull();
  });

  it('the settings: sending by colour (off = drafts) and the stop switch, saved through support-admin', async () => {
    mocks.result = { data: [], error: null };
    mocks.invokeResult = (body) => ({ ok: true, settings: { auto_send_green: true, auto_send_yellow: false, paused: false, ...body, action: undefined } });
    render(<AdminInquiries isHebrew />);
    fireEvent.click(await screen.findByTestId('inquiries-settings'));
    const green = await screen.findByTestId('inquiries-setting-auto_send_green');
    expect(green.checked).toBe(false);
    expect(screen.getByTestId('inquiries-settings-dialog').textContent).toContain('כל תשובה נשמרת כטיוטה לאישורכם');
    fireEvent.click(green);
    await waitFor(() => expect(mocks.invokes[0]).toEqual({ name: 'support-admin', body: { action: 'settings', auto_send_green: true } }));
    expect(screen.getByTestId('inquiries-setting-auto_send_green').checked).toBe(true);
  });

  it('Owner 2026-10-20 (L-22): every column sorts (colour = red first), the colour filter narrows, subjects align to the page start', async () => {
    mocks.result = { data: [DONE, DRAFT, RED], error: null };
    render(<AdminInquiries isHebrew />);
    await screen.findAllByTestId('inquiry-row');
    const order = () => screen.getAllByTestId('inquiry-row').map((r) => within(r).getByTestId('inquiry-subject').textContent);
    fireEvent.click(screen.getByTestId('inquiries-sort-bin'));
    expect(order()[0]).toBe('ביטול');
    fireEvent.click(screen.getByTestId('inquiries-sort-bin'));
    expect(order()[2]).toBe('ביטול');
    fireEvent.click(screen.getByTestId('inquiries-sort-state'));
    expect(order()).toEqual(['נענתה', 'איך מוסיפים לוגו?', 'ביטול']);
    fireEvent.click(screen.getByTestId('inquiries-sort-mailbox'));
    expect(screen.getAllByTestId('inquiry-mailbox')[0].textContent).toBe('info@tekango.com');
    fireEvent.change(screen.getByTestId('inquiries-bin-filter'), { target: { value: 'red' } });
    expect(order()).toEqual(['ביטול']);
    expect(screen.getAllByTestId('inquiry-subject')[0].style.textAlign).toBe('center');
  });

  it('the sidebar "פניות" item carries the red counter of what waits (none = no counter)', async () => {
    mocks.count = 3;
    render(<AdminSidebarNav section={null} onSelect={() => {}} isHebrew />);
    expect((await screen.findByTestId('admin-nav-inquiries-count')).textContent).toBe('3');
    cleanup();
    mocks.count = 0;
    render(<AdminSidebarNav section={null} onSelect={() => {}} isHebrew />);
    await waitFor(() => expect(screen.queryByTestId('admin-nav-inquiries-count')).toBeNull());
  });
});
