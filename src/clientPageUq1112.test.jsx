// Unified quote (Owner console 2026-11-11, spec section 2; typed incl. L-24 / L-26 / L-27 / L-28): the client page of a divided quote
// opens with every group OPEN; the arrow comes before the group name; a "full document / summary rows" switch above the list; a
// one-time explanation with "Got it" (remembered in this browser); the room tag beside each work row; the creator preview shows no
// switch and no explanation; the print window offers "full / partial document".
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicQuote from './pages/PublicQuote';
import PublicQuoteEn from './pages/PublicQuoteEn';
import { groupWord, defaultGroupName, roomLabel } from './utils/quoteGroups';

vi.mock('./shared/supabase', () => ({ supabase: { rpc: vi.fn().mockResolvedValue({ error: null }) } }));

const data = (overrides = {}) => ({
  quote: { id: 'a29b1fbb-f2ca-427d-88b2-6198d138eb89', quote_number: 100701, status: 'draft', signature: null, tax_rate: 0.18, client_type: 'business', is_owner_viewing: false, total: 20532, ...overrides.quote },
  business: { business_name: 'Test Business' },
  client: { company_name: 'Test Client' },
  items: [
    { description: 'Flooring', quantity: 12, price: 150, total_price: 1800, section_id: 's1', room: 'kitchen' },
    { description: 'Flooring', quantity: 30, price: 110, total_price: 3300, section_id: 's1', room: 'living' },
    { description: 'Windows', quantity: 4, price: 900, total_price: 3600, section_id: 's1', room: 'all' },
  ],
  sections: [{ id: 's1', name: 'דירה 1', repeat_count: 2, kind: 'apartment' }],
  attachments: [],
});

beforeEach(() => { try { window.localStorage.clear(); } catch { /* ignore */ } });

describe('the words of groups and rooms (one place, decision 1 / 2)', () => {
  it('uses the chosen word, "חלק" / "Section" as the fallback, and room tags in both languages', () => {
    expect(groupWord('apartment', true)).toBe('דירה');
    expect(groupWord('floor', false, { plural: true })).toBe('Floors');
    expect(groupWord(null, true)).toBe('חלק');
    expect(defaultGroupName('room', 1, true)).toBe('חדר 2');
    expect(roomLabel('all', true, 'apartment')).toBe('כל הדירה');
    expect(roomLabel('kitchen', false)).toBe('Kitchen');
    expect(roomLabel('מחסן', true)).toBe('מחסן');
    expect(roomLabel(null, true)).toBe('');
  });
});

describe.each([['HE', PublicQuote, 'תצוגת מסמך מלא', 'תצוגת שורות סיכום', 'הבנתי', 'מטבח', 'כל הדירה'],
  ['EN', PublicQuoteEn, 'Full document view', 'Summary rows view', 'Got it', 'Kitchen', 'The whole apartment']])(
  '%s client page of a divided quote', (_l, Page, full, summary, got, kitchen, whole) => {
    const mount = (props = {}) => render(<MemoryRouter><Page quoteData={data()} {...props} /></MemoryRouter>);

    it('opens with every group open, the arrow BEFORE the name, and the room tags beside the work', () => {
      mount();
      const toggle = document.querySelector('.pq-section-toggle');
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(toggle.textContent.trim().startsWith('▲')).toBe(true);
      expect(screen.getByText('Windows')).toBeInTheDocument();
      expect(screen.getByText(kitchen)).toBeInTheDocument();
      expect(screen.getByText(whole)).toBeInTheDocument();
    });

    it('the switch closes every group to its summary row and opens them again', () => {
      mount();
      fireEvent.click(screen.getByRole('button', { name: summary }));
      expect(screen.queryByText('Windows')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: summary }).getAttribute('aria-pressed')).toBe('true');
      fireEvent.click(screen.getByRole('button', { name: full }));
      expect(screen.getByText('Windows')).toBeInTheDocument();
    });

    it('the one-time explanation closes with "Got it" and does not come back in this browser', () => {
      const { unmount } = mount();
      const help = document.querySelector('.pq-group-help');
      expect(help).not.toBeNull();
      fireEvent.click(within(help).getByRole('button', { name: got }));
      expect(document.querySelector('.pq-group-help')).toBeNull();
      unmount();
      mount();
      expect(document.querySelector('.pq-group-help')).toBeNull();
    });

    it('the creator preview has no switch and no explanation', () => {
      mount({ previewMode: true });
      expect(document.querySelector('.pq-group-controls')).toBeNull();
    });
  });

describe('a flat quote keeps its table with no switch', () => {
  it('no group, no switch, no explanation', () => {
    const d = data(); d.sections = []; d.items = d.items.map((i) => ({ ...i, section_id: null }));
    render(<MemoryRouter><PublicQuote quoteData={d} /></MemoryRouter>);
    expect(document.querySelector('.pq-group-controls')).toBeNull();
  });
});
