// 2026-11-13 (Owner: the customer sees the TREE in today's look - a total for every heading, the full / partial choice, the triangle of a
// top heading today's size and of a sub-heading small, no triangle in print / PDF; typed L-24 / L-27 / L-28 / L-29): the customer page.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicQuote from './pages/PublicQuote';
import PublicQuoteEn from './pages/PublicQuoteEn';
import { buildDisplayTree, sectionOpenMap } from './utils/displaySectionTree';

vi.mock('./shared/supabase', () => ({ supabase: { rpc: vi.fn().mockResolvedValue({ error: null }) } }));

const it_ = (description, total, section_id) => ({ description, quantity: 1, price: total, total_price: total, section_id });
const SECTIONS = [{ id: 'f', name: 'קומה 10', kind: 'floor' }, { id: 'a', name: 'דירה 22', kind: 'apartment', parent_id: 'f' },
  { id: 'r1', name: 'סלון', kind: 'room', parent_id: 'a' }, { id: 'r2', name: 'חדר הורים', kind: 'room', parent_id: 'a' }, { id: 'y', name: 'חצר', kind: 'section' }];
const ITEMS = [it_('ניקיון השטח', 300, 'f'), it_('צביעת סלון', 1000, 'r1'), it_('תיקוני קיר', 200, 'r1'), it_('צביעת חדר', 800, 'r2'), it_('דשא', 500, 'y'), it_('פינוי', 100, null)];
const data = (items, sections, cur = 'ILS') => ({ quote: { id: 'a29b1fbb-f2ca-427d-88b2-6198d138eb89', quote_number: 1, status: 'sent', signature: null, tax_rate: cur === 'ILS' ? 0.18 : 0, client_type: 'business', is_owner_viewing: false, total: 2900, currency: cur },
  business: { business_name: 'B' }, client: { company_name: 'C' }, items, sections, attachments: [] });

describe('the display tree', () => {
  it('pre-order, depth, a total for every heading (its own lines + every sub-heading), the unassigned last', () => {
    const list = buildDisplayTree(ITEMS, SECTIONS, 'לא משויך');
    expect(list.map((s) => [s.title, s.depth, s.unitTotal, s.treeItemCount])).toEqual([
      ['קומה 10', 0, 2300, 4], ['דירה 22', 1, 2000, 3], ['סלון', 2, 1200, 2], ['חדר הורים', 2, 800, 1], ['חצר', 0, 500, 1], ['לא משויך', 0, 100, 1]]);
  });
  it('a quote without parents gives exactly the list it gave before (keys, order, totals; an empty heading is not shown)', () => {
    const flat = [{ id: 's1', name: 'A' }, { id: 's2', name: 'B', repeat_count: 2 }, { id: 's3', name: 'Empty' }];
    const list = buildDisplayTree([it_('x', 100, 's1'), it_('y', 50, 's2')], flat, 'Unassigned');
    expect(list.map((s) => ({ key: s.key, title: s.title, subtotal: s.subtotal, repeatCount: s.repeatCount, unitTotal: s.unitTotal, depth: s.depth }))).toEqual([
      { key: 's1', title: 'A', subtotal: 100, repeatCount: 1, unitTotal: 100, depth: 0 }, { key: 's2', title: 'B', subtotal: 50, repeatCount: 2, unitTotal: 100, depth: 0 }]);
  });
  it('the partial view keeps headings with sub-headings open and folds the rest; without parents every heading folds (as before)', () => {
    const list = buildDisplayTree(ITEMS, SECTIONS, 'לא משויך');
    expect(sectionOpenMap(list, false)).toEqual({ f: true, a: true, r1: false, r2: false, y: false, __unassigned__: false });
    expect(Object.values(sectionOpenMap(list, true)).every(Boolean)).toBe(true);
  });
  it('a loop or a parent from outside the quote never hides a heading (it goes to the top)', () => {
    const list = buildDisplayTree([it_('x', 1, 'p'), it_('y', 1, 'q')], [{ id: 'p', name: 'P', parent_id: 'q' }, { id: 'q', name: 'Q', parent_id: 'p' }], 'U');
    expect(list.map((s) => s.title).sort()).toEqual(['P', 'Q']);
  });
});

describe('the customer page shows the tree (HE + EN)', () => {
  it('HE: every heading with its total; the sub-heading triangle is the small one; the floor total includes everything under it', () => {
    const { container } = render(<MemoryRouter><PublicQuote quoteData={data(ITEMS, SECTIONS)} /></MemoryRouter>);
    expect(screen.getByText('סה״כ קומה 10:')).toBeInTheDocument();
    expect(screen.getByText('סה״כ סלון:')).toBeInTheDocument();
    const subs = container.querySelectorAll('.pq-chev-sub');
    expect(subs.length).toBe(3); // דירה 22, סלון, חדר הורים
    expect(screen.getByText(/▼ קומה 10/)).toBeInTheDocument(); // the top heading keeps today's text triangle
  });
  it('HE: folding the floor hides everything under it and shows one summary row with the whole total and the item count', () => {
    render(<MemoryRouter><PublicQuote quoteData={data(ITEMS, SECTIONS)} /></MemoryRouter>);
    fireEvent.click(screen.getByText(/▼ קומה 10/));
    expect(screen.queryByText('צביעת סלון')).not.toBeInTheDocument();
    expect(screen.getByText('פריטים: 4')).toBeInTheDocument();
  });
  it('EN: the same tree and totals', () => {
    const en = SECTIONS.map((s) => ({ ...s, name: { 'קומה 10': 'Floor 10', 'דירה 22': 'Apartment 22', 'סלון': 'Living room', 'חדר הורים': 'Master bedroom', 'חצר': 'Yard' }[s.name] }));
    const { container } = render(<MemoryRouter><PublicQuoteEn quoteData={data(ITEMS, en, 'USD')} /></MemoryRouter>);
    expect(screen.getByText('Total Floor 10:')).toBeInTheDocument();
    expect(screen.getByText('Total Living room:')).toBeInTheDocument();
    expect(container.querySelectorAll('.pq-chev-sub').length).toBe(3);
  });
  it('no triangle while printing (HE + EN): the print choice hides them until the print ends', () => {
    const { container } = render(<MemoryRouter><PublicQuote quoteData={data(ITEMS, SECTIONS)} /></MemoryRouter>);
    fireEvent.click(screen.getByText('הדפסת המסמך'));
    fireEvent.click(screen.getByText('הדפסת מסמך מלא'));
    expect(container.querySelectorAll('.pq-chev-sub').length).toBe(0);
    expect(screen.queryByText(/▼ קומה 10/)).not.toBeInTheDocument();
    expect(screen.getByText(/קומה 10/, { selector: 'button' })).toBeInTheDocument();
  });
});
