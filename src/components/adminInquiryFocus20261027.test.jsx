// Owner console 2026-10-27, typed: "מאשר את התוכנית לגיא ולמיכל, כולל שינוי ב-L-22 במסך הפניות" - the service card in the agents room
// links each red inquiry still waiting; the inquiries screen opens that one inquiry (HE + EN). Nothing else on the inquiries screen changes.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import AdminInquiries from './AdminInquiries';
import { ADMIN_DESTINATIONS } from './adminDestinations';
import { focusInquiry, peekInquiryFocus, takeInquiryFocus } from '../utils/adminInquiryFocus';

const mocks = vi.hoisted(() => ({ result: { data: [], error: null } }));
vi.mock('../shared/supabase', () => ({
  supabase: {
    from: () => {
      const q = { select() { return q; }, order() { return q; }, eq() { return q; }, in() { return Promise.resolve({ count: 0, error: null }); },
        limit() { return Promise.resolve(mocks.result); }, maybeSingle() { return Promise.resolve({ data: null, error: null }); } };
      return q;
    },
    functions: { invoke: async () => ({ data: null, error: null }) },
  },
}));
afterEach(() => { cleanup(); takeInquiryFocus(); });

const ROW = { id: 'a1', status: 'answered', bin: 'green', from_address: 'x@y.co', subject: 'שאלה רגילה', text_body: 'שלום', received_at: '2026-10-26T10:00:00Z' };
const RED = { id: 'b2', status: 'waiting', bin: 'red', bin_reason: 'word:privacy', from_address: 'dmarcreport@microsoft.com', subject: 'Report Domain: tekango.com', text_body: 'This is a DMARC aggregate report', draft_reply: null, received_at: '2026-10-20T11:28:00Z' };

describe('the inquiry focus hand-off', () => {
  it('peek keeps it, take reads and clears it, and a bad id is ignored', () => {
    focusInquiry('b2');
    expect(peekInquiryFocus()).toBe('b2');
    expect(peekInquiryFocus()).toBe('b2');
    expect(takeInquiryFocus()).toBe('b2');
    expect(takeInquiryFocus()).toBeNull();
    focusInquiry('');
    expect(peekInquiryFocus()).toBeNull();
  });
});

describe('the inquiries screen opens the focused inquiry', () => {
  it.each([[true], [false]])('isHebrew=%s: opens that inquiry once the list is loaded, and only once', async (isHebrew) => {
    mocks.result = { data: [ROW, RED], error: null };
    focusInquiry('b2');
    render(<AdminInquiries isHebrew={isHebrew} />);
    const dlg = await screen.findByTestId('inquiry-detail');
    expect(dlg.textContent).toContain('dmarcreport@microsoft.com');
    expect(dlg.textContent).toContain('This is a DMARC aggregate report');
    expect(peekInquiryFocus()).toBeNull();
    cleanup();
    // the next visit to the screen opens nothing by itself
    render(<AdminInquiries isHebrew={isHebrew} />);
    await screen.findAllByTestId('inquiry-row');
    expect(screen.queryByTestId('inquiry-detail')).toBeNull();
  });

  it('an id that is no longer in the list opens nothing; without a focus the screen is unchanged', async () => {
    mocks.result = { data: [ROW], error: null };
    focusInquiry('gone');
    render(<AdminInquiries isHebrew />);
    await screen.findAllByTestId('inquiry-row');
    expect(screen.queryByTestId('inquiry-detail')).toBeNull();
    expect(peekInquiryFocus()).toBeNull();
  });
});

describe('the agents room destination wires the link', () => {
  const room = ADMIN_DESTINATIONS.find((d) => d.id === 'agents-room');
  it('an account that may open the inquiries gets the link: it leaves the id and moves to the inquiries screen', () => {
    const navigate = vi.fn();
    const el = room.render({ isHebrew: true, navigate, can: () => true });
    el.props.onOpenInquiry('b2');
    expect(peekInquiryFocus()).toBe('b2');
    expect(navigate).toHaveBeenCalledWith('inquiries');
  });
  it('an account that may not open the inquiries gets plain text (no link)', () => {
    const el = room.render({ isHebrew: true, navigate: vi.fn(), can: (p) => p !== 'inquiries.view' });
    expect(el.props.onOpenInquiry).toBeNull();
  });
});
