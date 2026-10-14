import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicQuote from './PublicQuote';
import PublicQuoteEn from './PublicQuoteEn';
import { buildSampleQuote } from '../quoteDocument/sampleQuotes';

// Task 16 cloud-fix4b (A12) - item-table semantics that do not depend on the CSS display. On a phone a long-amount table
// is laid out as a grid with display:contents rows (narrowItems.css); the association of every value with its column
// header is therefore explicit in the markup: <th scope="col" id>, <td headers="<th id>">, explicit table / rowgroup /
// row / columnheader / cell roles, and DOM order = reading order (description, quantity, unit price, amount).
// jsdom has no layout: the runtime accessibility tree is checked in Chromium by scripts/task16/qa/a11y/table-semantics.mjs.
vi.mock('../shared/supabase', () => ({
  supabase: { rpc: vi.fn().mockResolvedValue({ error: null }), functions: { invoke: vi.fn() } },
}));
afterEach(() => cleanup());

const NOW = new Date('2026-10-04T09:00:00Z');
const KEYS = ['desc', 'qty', 'price', 'total'];
const PAGES = [
  { name: 'HE', locale: 'he', Page: PublicQuote, wrap: true },
  { name: 'EN', locale: 'en', Page: PublicQuoteEn, wrap: false },
];

function doc({ Page, locale }, { sections = false, wide = true } = {}) {
  const sample = buildSampleQuote({ locale, style: 'classic', length: 'short', images: false, now: NOW });
  let items = sample.quoteData.items.map((it, i) => (wide && i === 0 ? { ...it, calculated_quantity: 3.375, unit_price: 12500000, price: 12500000, total_price: 42187500 } : it));
  let extra = {};
  if (sections) {
    items = items.map((it, i) => ({ ...it, section_id: i % 2 ? 'sec-b' : 'sec-a' }));
    extra = { sections: [{ id: 'sec-a', name: 'A', sort_order: 0 }, { id: 'sec-b', name: 'B', sort_order: 1 }] };
  }
  return <Page quoteData={{ ...sample.quoteData, items, ...extra }} presentation={sample.presentation} />;
}
const mount = (p, o) => { const el = doc(p, o); return render(p.wrap ? <MemoryRouter>{el}</MemoryRouter> : el).container; };

// every value cell of a table -> the <th> its headers attribute names
function assertAssociation(container) {
  const table = container.querySelector('.pq-card table.pq-commercial-table');
  const ths = [...table.querySelectorAll(':scope > thead > tr > th')];
  expect(ths.map((t) => t.className)).toEqual(KEYS.map((k) => `pq-th-${k}`));
  for (const th of ths) {
    expect(th.getAttribute('scope')).toBe('col');
    expect(th.getAttribute('role')).toBe('columnheader');
    expect(th.id).toMatch(/\S/);
  }
  let checked = 0;
  for (const tr of table.querySelectorAll(':scope > tbody > tr')) {
    expect(tr.getAttribute('role')).toBe('row');
    const cells = [...tr.children];
    for (const td of cells) expect(td.getAttribute('role')).toBe('cell');
    const keyed = cells.filter((td) => /pq-td-/.test(td.className));
    // DOM order = reading order (description, quantity, unit price, amount)
    const order = keyed.map((td) => KEYS.find((k) => td.classList.contains(`pq-td-${k}`)));
    expect(order).toEqual(KEYS.filter((k) => order.includes(k)));
    for (const td of keyed) {
      const key = KEYS.find((k) => td.classList.contains(`pq-td-${k}`));
      const ids = (td.getAttribute('headers') || '').split(/\s+/).filter(Boolean);
      expect(ids.length, td.outerHTML.slice(0, 80)).toBeGreaterThan(0);
      const named = ids.map((id) => table.ownerDocument.getElementById(id));
      expect(named.every((th) => th && th.tagName === 'TH' && table.contains(th))).toBe(true);
      expect(named.map((th) => th.className)).toContain(`pq-th-${key}`);
      checked += 1;
    }
  }
  expect(checked).toBeGreaterThan(0);
  expect(table.getAttribute('role')).toBe('table');
  expect([...table.querySelectorAll(':scope > thead, :scope > tbody')].map((g) => g.getAttribute('role'))).toEqual(['rowgroup', 'rowgroup']);
  return table;
}

// spanning (colspan) cells: the association each one must carry, by meaning (local fix 5)
const SPAN_EXPECT = { 'section-heading': ['desc'], 'subtotal-label': ['desc'], 'general-quote': ['desc', 'total'] };
function spanKind(td) {
  if (td.querySelector('.pq-section-toggle')) return 'section-heading';
  if (td.closest('tr').classList.contains('pq-section-subtotal-row')) return 'subtotal-label';
  return 'general-quote';
}
function spanningProblems(table) {
  const problems = [];
  for (const td of table.querySelectorAll(':scope > tbody > tr > td[colspan]')) {
    const ids = (td.getAttribute('headers') || '').split(/\s+/).filter(Boolean);
    const named = ids.map((id) => table.ownerDocument.getElementById(id));
    const keys = named.map((th) => (th && th.tagName === 'TH' && table.contains(th) && th.getAttribute('scope') === 'col' ? KEYS.find((k) => th.classList.contains(`pq-th-${k}`)) : null));
    const want = SPAN_EXPECT[spanKind(td)];
    if (keys.some((k) => !k) || keys.length !== want.length || want.some((k) => !keys.includes(k)) || td.getAttribute('role') !== 'cell') problems.push({ kind: spanKind(td), headers: keys, want });
  }
  return problems;
}

describe('item table semantics - explicit header association and roles', () => {
  it.each(PAGES)('$name flat (long amounts): every value cell names its own column header; roles explicit; DOM order = reading order', (p) => {
    const table = assertAssociation(mount(p));
    expect(table.classList.contains('pq-amounts-wide')).toBe(true);
    // the accessible structure resolved by dom-accessibility-api: 1 header row + 1 row per item
    const rows = within(table).getAllByRole('row');
    expect(within(rows[0]).getAllByRole('columnheader').map((h) => h.className)).toEqual(KEYS.map((k) => `pq-th-${k}`));
    expect(within(rows[1]).getAllByRole('cell').map((c) => c.className)).toEqual(KEYS.map((k) => `pq-td-${k}`));
  });

  it.each(PAGES)('$name flat (amounts that fit): same association (the semantics never depend on the layout)', (p) => {
    const table = assertAssociation(mount(p, { wide: false }));
    expect(table.classList.contains('pq-amounts-wide')).toBe(false);
  });

  it.each(PAGES)('$name sections collapsed and expanded: summary, item and subtotal value cells keep their column header', (p) => {
    const c = mount(p, { sections: true });
    assertAssociation(c);
    for (const t of [...c.querySelectorAll('.pq-section-toggle')]) fireEvent.click(t);
    const table = assertAssociation(c);
    const sub = table.querySelector('tr.pq-section-subtotal-row td.pq-td-total');
    expect(table.ownerDocument.getElementById(sub.getAttribute('headers')).className).toBe('pq-th-total');
    // spanning cells (local fix 5, Codex P1 on 4a5eb18): the expanded section heading (colspan 4) and the subtotal label
    // (colspan 3) are the row's description -> associated with the description header only (not with every header)
    expect(spanningProblems(table)).toEqual([]);
    const kinds = [...table.querySelectorAll('td[colspan]')].map(spanKind);
    expect(kinds.filter((k) => k === 'section-heading').length).toBe(2);
    expect(kinds.filter((k) => k === 'subtotal-label').length).toBe(2);
    // negative control: removing the association from ANY one spanning cell must be detected
    for (const td of table.querySelectorAll('td[colspan]')) {
      const saved = td.getAttribute('headers');
      td.removeAttribute('headers');
      expect(spanningProblems(table).length, td.textContent).toBeGreaterThan(0);
      td.setAttribute('headers', saved);
    }
    expect(spanningProblems(table)).toEqual([]);
  });

  it('HE no-items quote: the general-quote line (colspan 4) is associated with description + amount, not quantity / unit price', () => {
    const sample = buildSampleQuote({ locale: 'he', style: 'classic', length: 'short', images: false, now: NOW });
    const c = render(<MemoryRouter><PublicQuote quoteData={{ ...sample.quoteData, items: [] }} presentation={sample.presentation} /></MemoryRouter>).container;
    const table = c.querySelector('.pq-card table.pq-commercial-table');
    const td = table.querySelector('tbody td[colspan="4"]');
    expect(spanKind(td)).toBe('general-quote');
    expect(spanningProblems(table)).toEqual([]);
    td.setAttribute('headers', td.getAttribute('headers').split(' ')[0]);
    expect(spanningProblems(table).length).toBeGreaterThan(0);
  });

  it('two documents on one page never share a header id (useId prefix)', () => {
    const { container } = render(<MemoryRouter><div>{doc(PAGES[0])}{doc(PAGES[0])}</div></MemoryRouter>);
    const ids = [...container.querySelectorAll('table.pq-commercial-table th[id]')].map((t) => t.id);
    expect(ids.length).toBe(8);
    expect(new Set(ids).size).toBe(8);
    for (const td of container.querySelectorAll('td[headers]')) {
      const th = container.ownerDocument.getElementById(td.getAttribute('headers'));
      expect(th.closest('table')).toBe(td.closest('table'));
    }
  });

  it('no data-label / caption mechanism was added (base Owner contract: same table, geometry only)', () => {
    for (const p of PAGES) {
      const c = mount(p, { sections: true });
      expect(c.querySelectorAll('[data-label]').length).toBe(0);
      expect(c.querySelector('.pq-card table.pq-commercial-table caption')).toBeNull();
      cleanup();
    }
  });
});

// IRON-NUMERIC-001 (local fix 7): a section SUMMARY amount (collapsed section row) is a summary value on the protected right
// axis - like the expanded section subtotal row; the centring exception covers item Quantity / Unit price / Amount only.
describe('section summary amounts sit on the protected right axis (not the item centring exception)', () => {
  it.each(PAGES)('$name: collapsed summary amount right-aligned; its count / dash cells stay centred', (p) => {
    const table = mount(p, { sections: true }).querySelector('.pq-card table.pq-commercial-table');
    const summaryRows = [...table.querySelectorAll('tbody tr')].filter((tr) => tr.querySelector('.pq-section-toggle[aria-expanded="false"]'));
    expect(summaryRows.length).toBeGreaterThan(1);
    for (const tr of summaryRows) {
      expect(tr.querySelector('td.pq-td-total').style.textAlign).toBe('right');
      expect(tr.querySelector('td.pq-td-total').classList.contains('pq-td-summary')).toBe(true);
      expect(tr.querySelector('td.pq-td-qty').style.textAlign).toBe('center');
      expect(tr.querySelector('td.pq-td-price').style.textAlign).toBe('center');
    }
  });
});
