import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import PublicQuote from '../pages/PublicQuote';
import PublicQuoteEn from '../pages/PublicQuoteEn';
import { buildSampleQuote } from './sampleQuotes';

// Task 16 cloud-fix4 (A12) - narrow item rows for long amounts (src/quoteDocument/narrowItems.css).
// jsdom evaluates neither @media / @container nor layout, so these tests pin the CONTRACT of the stylesheet and of the
// DOM it relies on; the geometry itself is measured in a real browser by scripts/task16/qa/print/long-amounts.mjs.
//  - base Owner contract (Public Quote Mobile 4-Column Geometry Correction): the SAME table / colgroup / row markup at
//    every breakpoint, geometry only - no data-label, no ::before/::after captions, no hidden header, no separate DOM;
//  - scoped: only a table marked pq-amounts-wide, only in a phone-width document (screen media <= 420px outside the
//    creator preview / Direct PDF capture, or the pq-preview container <= 420px), never print;
//  - values stay complete: nothing in the file hides, clips, ellipsizes or wraps a value or shrinks text below 12px.
vi.mock('../shared/supabase', () => ({
  supabase: { rpc: vi.fn().mockResolvedValue({ error: null }), functions: { invoke: vi.fn() } },
}));
afterEach(() => cleanup());

const read = (p) => readFileSync(join(cwd(), p), 'utf8');
const narrow = read('src/quoteDocument/narrowItems.css');
const docCss = read('src/quoteDocument/quoteDocument.css');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

// top-level blocks of a stylesheet: [{ prelude, body }] (brace matching; enough for this hand-written file)
function topBlocks(src) {
  const s = stripComments(src);
  const out = [];
  let i = 0;
  while (i < s.length) {
    const open = s.indexOf('{', i);
    if (open < 0) { if (s.slice(i).trim()) out.push({ prelude: s.slice(i).trim(), body: null }); break; }
    let depth = 1; let j = open + 1;
    while (j < s.length && depth) { if (s[j] === '{') depth += 1; else if (s[j] === '}') depth -= 1; j += 1; }
    out.push({ prelude: s.slice(i, open).trim(), body: s.slice(open + 1, j - 1) });
    i = j;
  }
  return out;
}
// rules inside one block body: [{ selector, decls }]
const rulesOf = (body) => topBlocks(body).map((b) => ({ selector: b.prelude.replace(/\s+/g, ' '), decls: (b.body || '').trim() }));

const MEDIA = '@media screen and (max-width: 420px)';
const CONTAINER = '@container pq-preview (max-width: 420px)';
const blocks = topBlocks(narrow);

const NOW = new Date('2026-10-04T09:00:00Z');
const PAGES = [
  { name: 'HE', locale: 'he', Page: PublicQuote, wrap: true },
  { name: 'EN', locale: 'en', Page: PublicQuoteEn, wrap: false },
];
function renderLong({ Page, wrap, locale }, sections) {
  const sample = buildSampleQuote({ locale, style: 'classic', length: 'short', images: false, now: NOW });
  let items = sample.quoteData.items.map((it, i) => (i === 0 ? { ...it, calculated_quantity: 3.375, unit_price: 12500000, price: 12500000, total_price: 42187500 } : it));
  let extra = {};
  if (sections) {
    items = items.map((it, i) => ({ ...it, section_id: i % 2 ? 'sec-b' : 'sec-a' }));
    extra = { sections: [{ id: 'sec-a', name: 'A', sort_order: 0 }, { id: 'sec-b', name: 'B', sort_order: 1 }] };
  }
  const el = <Page quoteData={{ ...sample.quoteData, items, ...extra }} presentation={sample.presentation} />;
  return render(wrap ? <MemoryRouter>{el}</MemoryRouter> : el).container;
}

describe('narrowItems.css - scope', () => {
  it('both document pages import it AFTER quoteDocument.css (so it can override the cloud-fix3 phone rules)', () => {
    for (const p of ['src/pages/PublicQuote.jsx', 'src/pages/PublicQuoteEn.jsx']) {
      const src = read(p);
      const a = src.indexOf("import '../quoteDocument/quoteDocument.css'");
      const b = src.indexOf("import '../quoteDocument/narrowItems.css'");
      expect(a, p).toBeGreaterThanOrEqual(0);
      expect(b, p).toBeGreaterThan(a);
    }
  });

  it('has exactly two blocks - phone screen media and the phone-width preview container - and no rule outside them', () => {
    expect(blocks.map((b) => b.prelude)).toEqual([MEDIA, CONTAINER]);
    expect(narrow).not.toMatch(/@media[^{]*print/);
  });

  it('every rule targets only a pq-amounts-wide commercial table; the media block excludes the preview and the Direct PDF capture', () => {
    const media = rulesOf(blocks[0].body);
    const cont = rulesOf(blocks[1].body);
    expect(media.length).toBeGreaterThan(5);
    for (const r of media) {
      for (const sel of r.selector.split(',').map((x) => x.trim())) {
        expect(sel).toMatch(/^\.pq-page:not\(\.pq-preview\):not\(\.pq-pdf-capturing\) \.pq-card \.pq-commercial-table\.pq-amounts-wide(\s|>|$)/);
      }
    }
    for (const r of cont) {
      for (const sel of r.selector.split(',').map((x) => x.trim())) {
        expect(sel).toMatch(/^\.pq-page\.pq-preview \.pq-card \.pq-commercial-table\.pq-amounts-wide(\s|>|$)/);
      }
    }
  });

  it('the preview container block declares the same geometry as the screen media block (same rules, same declarations)', () => {
    const norm = (rules, prefix) => rules.map((r) => ({ selector: r.selector.split(prefix).join('<T>'), decls: r.decls.replace(/\s+/g, ' ') }));
    expect(norm(rulesOf(blocks[1].body), '.pq-page.pq-preview .pq-card .pq-commercial-table.pq-amounts-wide'))
      .toEqual(norm(rulesOf(blocks[0].body), '.pq-page:not(.pq-preview):not(.pq-pdf-capturing) .pq-card .pq-commercial-table.pq-amounts-wide'));
  });

  it('uses an existing breakpoint: the <=420px phone rules of quoteDocument.css (viewport and pq-preview container)', () => {
    expect(docCss).toMatch(/@media \(max-width: 420px\) \{\s*\.pq-card \.pq-col-desc/);
    expect(docCss).toMatch(/@container pq-preview \(max-width: 420px\) \{\s*\.pq-page\.pq-preview \.pq-card \.pq-col-desc/);
  });
});

describe('narrowItems.css - geometry only (base Owner contract)', () => {
  const body = stripComments(narrow);
  it('no captions, no hidden header, no stacked cards: no ::before / ::after / content / attr() / data-label, thead never hidden', () => {
    expect(body).not.toMatch(/::?(before|after)/);
    expect(body).not.toMatch(/\bcontent\s*:/);
    expect(body).not.toMatch(/attr\(|data-label/);
    for (const r of [...rulesOf(blocks[0].body), ...rulesOf(blocks[1].body)]) {
      if (/display:\s*none/.test(r.decls)) expect(r.selector).toMatch(/> colgroup$/); // only the unused <colgroup> box
    }
  });

  it('never hides, clips, ellipsizes or wraps a value, never shrinks text, never changes alignment', () => {
    expect(body).not.toMatch(/overflow\s*:|text-overflow|white-space|word-break|font-size|visibility|opacity|text-align|transform|position\s*:/);
  });

  it('one grid shared by every row: thead / tbody / tr are display:contents, the description spans the row, Qty / Unit price / Amount are tracks 1 / 2 / 3', () => {
    const media = rulesOf(blocks[0].body);
    const find = (re) => media.find((r) => re.test(r.selector));
    expect(find(/amounts-wide$/).decls).toMatch(/display:\s*grid;\s*grid-template-columns:\s*14fr 24fr 28fr;/);
    expect(find(/> thead,/).selector).toMatch(/> tbody > tr$/);
    expect(find(/> thead,/).decls).toMatch(/display:\s*contents/);
    expect(find(/th\.pq-th-desc,/).decls).toMatch(/grid-column:\s*1 \/ -1/);
    expect(find(/th\.pq-th-desc,/).selector).toMatch(/td\.pq-td-desc/);
    expect(find(/th\.pq-th-desc,/).selector).toMatch(/td\[colspan="4"\]/);
    expect(find(/\.pq-th-qty,/).decls).toMatch(/grid-column:\s*1;/);
    expect(find(/\.pq-th-price,/).decls).toMatch(/grid-column:\s*2;/);
    expect(find(/\.pq-th-total,/).decls).toMatch(/grid-column:\s*3;/);
    expect(find(/pq-section-subtotal-row > td\[colspan="3"\]$/).decls).toMatch(/grid-column:\s*1 \/ 3/);
  });

  it('the three value tracks keep the proportions of the approved phone <colgroup> numeric columns (14% / 24% / 28%)', () => {
    const m = docCss.match(/@media \(max-width: 420px\) \{\s*\.pq-card \.pq-col-desc \{ width: (\d+)% !important; \}\s*\.pq-card \.pq-col-qty \{ width: (\d+)% !important; \}\s*\.pq-card \.pq-col-price \{ width: (\d+)% !important; \}\s*\.pq-card \.pq-col-total \{ width: (\d+)% !important; \}/);
    expect(m).not.toBeNull();
    expect(narrow).toContain(`grid-template-columns: ${m[2]}fr ${m[3]}fr ${m[4]}fr;`);
  });
});

describe('narrowItems.css - visual order = DOM / reading order (cloud-fix4b)', () => {
  it('no order / grid-row / grid-area / direction override; Qty, Unit price, Amount take tracks 1, 2, 3 in DOM order (track 1 is the inline start in RTL and LTR)', () => {
    const body = stripComments(narrow);
    expect(body).not.toMatch(/(^|[\s;{])order\s*:|grid-row|grid-area|grid-auto-flow|direction\s*:|flex-direction/);
    const tracks = ['qty', 'price', 'total'].map((k) => {
      const r = rulesOf(blocks[0].body).find((x) => x.selector.includes(`td.pq-td-${k}`) && !x.selector.includes('pq-td-desc'));
      return Number((r.decls.match(/grid-column:\s*(\d+);/) || [])[1]);
    });
    expect(tracks).toEqual([1, 2, 3]);
  });
});

describe('narrowItems.css - the DOM it relies on is the unchanged four-column table', () => {
  it.each(PAGES)('$name: flat long amounts - pq-amounts-wide, one colgroup of 4, header of 4 labelled cells, every item row = 4 cells (desc + qty + price + total)', (p) => {
    const c = renderLong(p, false);
    const table = c.querySelector('.pq-card table.pq-commercial-table');
    expect(table.classList.contains('pq-amounts-wide')).toBe(true);
    expect([...table.querySelectorAll(':scope > colgroup > col')].map((x) => x.className)).toEqual(['pq-col-desc', 'pq-col-qty', 'pq-col-price', 'pq-col-total']);
    const ths = [...table.querySelectorAll(':scope > thead > tr > th')];
    expect(ths.map((x) => x.className)).toEqual(['pq-th-desc', 'pq-th-qty', 'pq-th-price', 'pq-th-total']);
    expect(ths.every((x) => x.textContent.trim().length > 0)).toBe(true);
    for (const tr of table.querySelectorAll(':scope > tbody > tr')) {
      expect([...tr.children].map((x) => x.className)).toEqual(['pq-td-desc', 'pq-td-qty', 'pq-td-price', 'pq-td-total']);
    }
    expect(c.querySelectorAll('[data-label]').length).toBe(0);
  });

  it.each(PAGES)('$name: sections - the full-width heading is colspan 4, the subtotal row is colspan 3 + pq-td-total (the cells the grid places)', (p) => {
    const c = renderLong(p, true);
    const table = c.querySelector('.pq-card table.pq-commercial-table');
    expect(table.classList.contains('pq-amounts-wide')).toBe(true);
    for (const t of [...c.querySelectorAll('.pq-section-toggle')]) fireEvent.click(t);
    const heads = [...table.querySelectorAll('tbody > tr > td[colspan="4"]')];
    expect(heads.length).toBe(2);
    const subs = [...table.querySelectorAll('tbody > tr.pq-section-subtotal-row')];
    expect(subs.length).toBe(2);
    for (const s of subs) expect([...s.children].map((x) => `${x.getAttribute('colspan') || 1}:${x.className}`)).toEqual(['3:', '1:pq-td-total']);
  });
});
