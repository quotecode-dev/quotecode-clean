// Owner console 2026-10-19, typed: "מאשר שינוי ב-L-22: לשונית "פניות" חדשה בממשק הניהול" - the smart support email stage 1, read-only.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import AdminInquiries from './AdminInquiries';
import { ADMIN_DESTINATIONS } from './adminDestinations';

const mocks = vi.hoisted(() => ({ result: { data: [], error: null }, calls: [] }));
vi.mock('../shared/supabase', () => ({
  supabase: {
    from: (table) => {
      const q = { table, select(cols) { q.cols = cols; return q; }, order() { return q; }, limit() { mocks.calls.push(q); return Promise.resolve(mocks.result); } };
      for (const verb of ['insert', 'update', 'upsert', 'delete']) q[verb] = () => { throw new Error(`write ${verb}`); };
      return q;
    },
  },
}));
afterEach(() => { cleanup(); mocks.calls = []; });

const ROW = { id: 'r1', from_address: 'noa@customer.test', from_name: 'Noa Cohen', to_addresses: ['support@inbound.tekango.test'], subject: 'איך מוסיפים לוגו?', text_body: 'שלום,\nאיך מוסיפים לוגו להצעה?', attachments: [{ filename: 'shot.png' }], auth_results: { spf: 'pass', dkim: 'pass', dmarc: 'fail' }, received_at: '2026-10-19T18:00:00Z' };

describe('Admin "Inquiries" tab (Owner 2026-10-19, L-22)', () => {
  it('is one registry destination in the Management group, super admin only, phone "More" list', () => {
    const d = ADMIN_DESTINATIONS.find((x) => x.id === 'inquiries');
    expect(d).toMatchObject({ group: 'management', permission: 'super_admin', mobile: 'more', available: true, label: { he: 'פניות', en: 'Inquiries' } });
  });

  it('lists the received inquiries read-only; a row opens the full text, the attachments (names only) and the sender checks', async () => {
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
