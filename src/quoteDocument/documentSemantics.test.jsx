import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import PublicQuote from '../pages/PublicQuote';
import PublicQuoteEn from '../pages/PublicQuoteEn';
import { buildSampleQuote } from './sampleQuotes';
import { LIGHT } from '../theme/neonTheme';

// Task 16 - quote DOCUMENT semantics (2026-10-05):
//  1. Roles: the client block ("לכבוד" / "To") holds the client's data, the contact block ("לידי" / "Attn") the Attn
//     person; the business is never inside a role block and appears in the letterhead exactly once. No Attn => no
//     contact block.
//  2. Recipient prominence restored from the approved base c65f742 (client name 800 in LIGHT.violet, card treatment).
//  3. Owner decision 2026-10-05: local exception to IRON-NUMERIC-001 - the Quantity / Unit price / Amount columns of the
//     items table (th + td) are centred; the totals grid keeps its shared right edge.
vi.mock('../shared/supabase', () => ({
  supabase: { rpc: vi.fn().mockResolvedValue({ error: null }), functions: { invoke: vi.fn() } },
}));

afterEach(() => cleanup());

const NOW = new Date('2026-10-04T09:00:00Z');
const css = readFileSync(join(cwd(), 'src/quoteDocument/quoteDocument.css'), 'utf8');

const PAGES = [
  { name: 'HE', locale: 'he', Page: PublicQuote, wrap: true, client: 'לכבוד', contact: 'לידי', descAlign: 'right' },
  { name: 'EN', locale: 'en', Page: PublicQuoteEn, wrap: false, client: 'To', contact: 'Attn', descAlign: 'left' },
];
const STYLES = ['classic', 'modern', 'visual'];

function renderDoc({ Page, wrap, locale }, style, quoteOverrides = {}, extra = {}) {
  const sample = buildSampleQuote({ locale, style, length: 'long', images: false, now: NOW });
  const quoteData = { ...sample.quoteData, quote: { ...sample.quoteData.quote, ...quoteOverrides }, ...extra };
  const el = <Page quoteData={quoteData} presentation={sample.presentation} />;
  const out = render(wrap ? <MemoryRouter>{el}</MemoryRouter> : el);
  return { ...out, quoteData };
}

const count = (hay, needle) => hay.split(needle).length - 1;

describe.each(PAGES)('$name quote document - recipient roles and prominence', (page) => {
  it.each(STYLES)('%s: client block = label + client company; contact block = label + Attn name; business only in the letterhead', (style) => {
    const { container, quoteData } = renderDoc(page, style);
    const card = container.querySelector('.pq-card');
    expect(card.className).toContain(`pq-style-${style}`);

    const client = card.querySelector('[data-role="client"]');
    const contact = card.querySelector('[data-role="contact"]');
    expect(client).not.toBeNull();
    expect(contact).not.toBeNull();
    expect(client.querySelector('.pq-recipient-label').textContent).toContain(page.client);
    expect(client.querySelector('.pq-recipient-name').textContent).toBe(quoteData.client.company_name);
    expect(contact.querySelector('.pq-recipient-label').textContent).toContain(page.contact);
    expect(contact.querySelector('.pq-recipient-name').textContent).toBe(quoteData.quote.attn_name);
    // client first in DOM, contact independent (not nested)
    expect(client.compareDocumentPosition(contact) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(client.contains(contact)).toBe(false);
    expect(contact.textContent).not.toContain(quoteData.client.company_name);

    const biz = quoteData.business.business_name;
    for (const block of card.querySelectorAll('[data-role]')) expect(block.textContent).not.toContain(biz);
    const letterheads = card.querySelectorAll('.pq-letterhead');
    expect(letterheads.length).toBe(1);
    expect(count(letterheads[0].textContent, biz)).toBe(1);
  });

  it.each(STYLES)('%s: no Attn => no contact block (client block stays)', (style) => {
    const { container } = renderDoc(page, style, { attn_name: null, attn_role: null });
    expect(container.querySelector('[data-role="contact"]')).toBeNull();
    expect(container.querySelector('[data-role="client"]')).not.toBeNull();
    expect(container.querySelectorAll('.pq-recipient').length).toBe(1);
    cleanup();
    const { container: c2 } = renderDoc(page, style, { attn_name: '', attn_role: '' });
    expect(c2.querySelector('[data-role="contact"]')).toBeNull();
  });

  it('the client name carries the restored base emphasis (CSS: 800 weight, LIGHT.violet, 1.2rem; base card treatment)', () => {
    const { container } = renderDoc(page, 'classic');
    const name = container.querySelector('[data-role="client"] .pq-recipient-name');
    expect(name.classList.contains('pq-recipient-name')).toBe(true);
    // No inline override weakens the class treatment.
    expect(name.style.color).toBe('');
    expect(name.style.fontWeight).toBe('');
  });
});

describe.each(PAGES)('$name quote document - attachments block always present (base c65f742, retro audit R-5)', (page) => {
  const TITLE = { he: 'קבצים ושרטוטים מצורפים להצעה:', en: 'Attached Files & Documents:' };
  const EMPTY = { he: 'אין קובץ מצורף להצעה זו', en: 'No attachment included with this quote.' };
  it.each(STYLES)('%s: no attachments => the block renders with the base title and the empty-state line, no links', (style) => {
    const { container } = renderDoc(page, style, {}, { attachments: [] });
    const blocks = container.querySelectorAll('.pq-card .pq-attachments');
    expect(blocks.length).toBe(1);
    expect(blocks[0].querySelector('.pq-attachments-title').textContent).toContain(TITLE[page.locale]);
    expect(blocks[0].querySelector('.pq-attachments-empty').textContent).toBe(EMPTY[page.locale]);
    expect(blocks[0].querySelector('a')).toBeNull();
    cleanup();
    const { container: c2 } = renderDoc(page, style, {}, { attachments: null });
    expect(c2.querySelector('.pq-card .pq-attachments .pq-attachments-empty').textContent).toBe(EMPTY[page.locale]);
  });
  it('with attachments => links, no empty-state line', () => {
    const { container } = renderDoc(page, 'classic', {}, { attachments: [{ url: 'https://example.com/a.pdf', file_name: 'a.pdf' }] });
    const block = container.querySelector('.pq-card .pq-attachments');
    expect(block.querySelector('a[href="https://example.com/a.pdf"]').textContent).toContain('a.pdf');
    expect(block.querySelector('.pq-attachments-empty')).toBeNull();
    expect(block.classList.contains('pq-attachments--empty')).toBe(false);
  });
  it('base container (ledger D17): panel, frame, radius, padding, violet paperclip + links; readable empty line (Q5); no A4 one-line override (ledger D18)', () => {
    const { container } = renderDoc(page, 'modern', {}, { attachments: [] });
    const block = container.querySelector('.pq-card .pq-attachments');
    expect(block.classList.contains('pq-attachments--empty')).toBe(true);
    expect(block.classList.contains('pq-doc-note')).toBe(false);
    const rule = (sel) => { const m = css.match(new RegExp(`\\n${sel.replace(/\./g, '\\.')} \\{([^}]*)\\}`)); expect(m, sel).toBeTruthy(); return m[1]; };
    const panel = rule('.pq-card .pq-attachments');
    expect(panel).toMatch(/margin: 0 0 25px;/);
    expect(panel).toMatch(/padding: 15px 20px;/);
    expect(panel).toMatch(/background: #f8fafc;/);
    expect(panel).toMatch(/border: 1px solid #e2e8f0;/);
    expect(panel).toMatch(/border-radius: 10px;/);
    const title = rule('.pq-card .pq-attachments-title');
    expect(title).toMatch(/font-size: 0\.85rem;/);
    expect(title).toMatch(/font-weight: 700;/);
    expect(title).toMatch(/color: #1e293b;/);
    expect(rule('.pq-card .pq-attachments-title svg')).toMatch(/color: #7c3aed;/);
    const link = rule('.pq-card .pq-attachment-link');
    expect(link).toMatch(/color: #7c3aed;/);
    expect(link).toMatch(/text-decoration: underline;/);
    expect(link).toMatch(/font-size: 0\.9rem;/);
    expect(link).toMatch(/font-weight: 600;/);
    expect(rule('.pq-card .pq-attachments-empty')).toMatch(/color: #64748b;/);
    // ledger D18: the one-line Print / Direct PDF override of the empty block is gone
    expect(css).not.toMatch(/pq-attachments\.pq-attachments--empty/);
  });
});

describe('quoteDocument.css - recipient treatment restored from base c65f742 for every style', () => {
  const rule = (sel) => {
    const m = css.match(new RegExp(`\\n${sel.replace(/\./g, '\\.')} \\{([^}]*)\\}`));
    expect(m, sel).toBeTruthy();
    return m[1];
  };
  it('card, label, name and details match the base values (LIGHT.violet / LIGHT.border)', () => {
    expect(LIGHT.violet.toLowerCase()).toBe('#7c3aed');
    const card = rule('.pq-card .pq-recipient');
    expect(card).toMatch(new RegExp(`--pq-recipient-violet: ${LIGHT.violet}`, 'i'));
    expect(card).toMatch(/background: #faf9fd;/);
    expect(card).toMatch(new RegExp(`border: 1px solid ${LIGHT.border}`, 'i'));
    expect(card).toMatch(/border-inline-start: 4px solid var\(--pq-recipient-violet\);/);
    expect(card).toMatch(/border-radius: 12px;/);
    const label = rule('.pq-card .pq-recipient-label');
    expect(label).toMatch(/font-weight: 800;/);
    expect(label).toMatch(/text-transform: uppercase;/);
    expect(label).toMatch(/color: #1e293b;/);
    const name = rule('.pq-card .pq-recipient-name');
    expect(name).toMatch(/font-size: 1\.2rem;/);
    expect(name).toMatch(/font-weight: 800;/);
    expect(name).toMatch(/color: var\(--pq-recipient-violet\);/);
    expect(rule('.pq-card .pq-recipient-detail')).toMatch(/color: var\(--pq-recipient-violet\);/);
  });
  it('retro audit R-6: the faint token (3.67:1) is no longer used for document text', () => {
    const uses = [...css.matchAll(/^(.*)color: var\(--pq-faint\)/gm)];
    // only the letterhead meta-label default remains, and it is always inside the dark band / overridden in print+PDF
    expect(uses.length).toBe(1);
    expect(css).toMatch(/\.pq-card \.pq-doc-foot \{[^}]*color: #64748b;/);
    expect(css).toMatch(/\.pq-letterhead \.pq-doc-kicker \{[^}]*color: var\(--pq-muted\);/);
    // Owner console 2026-10-18, typed: "זה חייב להראות בדיוק כמו המסך רק מבלי להדפיס את ההדר בשחור" - Print and the Direct PDF ARE the screen document
    expect(css).toMatch(/\.pq-pdf-capturing \.pq-letterhead \.pq-lh-band \.pq-meta-label,\s*\.pq-pdf-capturing \.pq-letterhead \.pq-lh-band \.pq-doc-kicker \{\s*color: var\(--pq-muted\) !important;/);
  });
  // Owner console 2026-10-18, typed: "זה חייב להראות בדיוק כמו המסך רק מבלי להדפיס את ההדר בשחור" - Print and the Direct PDF ARE the screen document
  it('all three styles share one landing-parity recipient treatment - on screen, in Print and in the Direct PDF alike', () => {
    expect(css).not.toMatch(/\.pq-style-(modern|visual) \.pq-recipient[\s,{]/);
    expect(css).toMatch(/@media screen, print \{[\s\S]*\n {2}\.pq-page \.pq-card \.pq-recipient \{[\s\S]*background: transparent;[\s\S]*border-top: 2px solid var\(--pq-accent\);/);
    expect(css).toMatch(/\n {2}\.pq-page \.pq-card \.pq-parties \{[\s\S]*grid-template-columns: minmax\(0, 1\.45fr\) minmax\(0, \.75fr\);/);
    expect(css).toMatch(/\n {2}\.pq-page \.pq-card \.pq-recipient-client \{[\s\S]*padding: 12px 14px;[\s\S]*background: #f3f7f7;[\s\S]*border: 1px solid #d8e2e3;[\s\S]*border-inline-start: 4px solid var\(--pq-accent\);[\s\S]*border-radius: 8px;/);
    expect(css).toMatch(/\n {2}\.pq-page \.pq-card \.pq-recipient-client \.pq-recipient-name \{[\s\S]*font-size: 19px;[\s\S]*font-weight: 800;[\s\S]*color: var\(--pq-accent\);/);
  });
});

describe.each(PAGES)('$name quote document - centred item columns (Owner decision 2026-10-05)', (page) => {
  it.each(STYLES)('%s: Quantity / Unit price / Amount th + td are centred; description keeps language direction; totals are not centred', (style) => {
    const { container } = renderDoc(page, style);
    const table = container.querySelector('table.pq-commercial-table');
    const ths = table.querySelectorAll('thead th');
    expect(ths.length).toBe(4);
    expect(ths[0].style.textAlign).toBe(page.descAlign);
    for (const th of [ths[1], ths[2], ths[3]]) expect(th.style.textAlign).toBe('center');
    expect([...ths].slice(1).map((t) => t.className)).toEqual(['pq-th-qty', 'pq-th-price', 'pq-th-total']);
    const rows = table.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThan(3);
    rows.forEach((tr) => {
      const tds = tr.querySelectorAll('td');
      expect(tds.length).toBe(4);
      expect(tds[1].className).toBe('pq-td-qty');
      expect(tds[2].className).toBe('pq-td-price');
      expect(tds[3].className).toBe('pq-td-total');
      for (const td of [tds[1], tds[2], tds[3]]) expect(td.style.textAlign).toBe('center');
      // money keeps its LTR-isolated tabular atom
      expect(tds[2].querySelector('.pf-money')).not.toBeNull();
      expect(tds[3].querySelector('.pf-money')).not.toBeNull();
    });
    // totals grid: no centring anywhere from the value up to the card
    const values = container.querySelectorAll('.pq-totals-box .pq-total-value, .pq-totals-box .pq-total-final-amount');
    expect(values.length).toBeGreaterThan(1);
    values.forEach((v) => {
      for (let el = v; el && !el.classList.contains('pq-card'); el = el.parentElement) expect(el.style.textAlign).not.toBe('center');
    });
  });

  // local fix 7 (IRON-NUMERIC-001; Codex audit: the centring exception covers item columns only, never a summary): the collapsed
  // section summary keeps its count and dash centred, but its AMOUNT is a summary value on the protected right axis (it was
  // centred by ca52204 and drifted 13-18px between sections of different magnitude).
  it('section rows: collapsed summary count / dash centred and summary AMOUNT on the right axis; expanded items centre the three columns; the section SUBTOTAL row is right-aligned', () => {
    const sample = buildSampleQuote({ locale: page.locale, length: 'short', images: false, now: NOW });
    const items = sample.quoteData.items.map((it) => ({ ...it, section_id: 'sec1' }));
    const { container, getByText } = renderDoc(page, 'classic', {}, { items, sections: [{ id: 'sec1', name: 'Room A' }] });
    const summary = getByText(/Room A ▼/).closest('tr').querySelectorAll('td');
    for (const td of [summary[1], summary[2]]) expect(td.style.textAlign).toBe('center');
    expect(summary[3].style.textAlign).toBe('right');
    fireEvent.click(getByText(/Room A ▼/));
    const body = container.querySelectorAll('table.pq-commercial-table tbody tr');
    let checked = 0;
    body.forEach((tr) => {
      if (tr.classList.contains('pq-section-subtotal-row')) return;
      tr.querySelectorAll('td.pq-td-qty, td.pq-td-price, td.pq-td-total').forEach((td) => { expect(td.style.textAlign).toBe('center'); checked += 1; });
    });
    expect(checked).toBeGreaterThanOrEqual(items.length * 3);
    const subtotalRow = container.querySelector('.pq-section-subtotal-row');
    expect(subtotalRow.querySelector('td.pq-td-total').style.textAlign).toBe('right');
  });
});

describe('quoteDocument.css - the centring exception stays local', () => {
  it('declares the centred rule for exactly the three item columns, and the totals values keep text-align:right', () => {
    const m = css.match(/((?:\.pq-card \.pq-commercial-table [^{,]+,\s*)+\.pq-card \.pq-commercial-table [^{,]+)\{\s*text-align: center;\s*\}/);
    expect(m).toBeTruthy();
    const sels = m[1].split(',').map((s) => s.trim().replace('.pq-card .pq-commercial-table ', ''));
    expect(sels.sort()).toEqual(['.pq-th-price', '.pq-th-qty', '.pq-th-total', 'td.pq-td-price', 'td.pq-td-qty', 'td.pq-td-total'].sort());
    expect(css).toMatch(/Owner decision 2026-10-05: local exception to IRON-NUMERIC-001/);
    expect(css).toMatch(/\.pq-card \.pq-total-value \{[^}]*text-align: right;/);
    expect(css).toMatch(/\.pq-card \.pq-total-final-amount \{[^}]*text-align: right;/);
    const screenParityAt = css.indexOf('/* ---------- screen parity with the Owner-approved landing quotation');
    const outputModesAt = css.indexOf('/* ---------- header band: output modes');
    const nonScreenCss = css.slice(0, screenParityAt) + css.slice(outputModesAt);
    // output modes and the preserved base do not re-align the table cells
    for (const r of nonScreenCss.matchAll(/([^{}]*\.pq-commercial-table[^{}]*)\{([^}]*)\}/g)) {
      if (!/text-align/.test(r[2])) continue;
      // the only non-centred rule is the section SUBTOTAL row (a subtotal - outside the exception)
      if (/\.pq-section-subtotal-row td\.pq-td-total\s*$/.test(r[1].trim())) expect(r[2]).toMatch(/text-align: right;/);
      else expect(r[2]).toMatch(/text-align: center;/);
    }
    const screenCss = css.slice(screenParityAt, outputModesAt);
    expect(screenCss).toMatch(/\.pq-th-qty,[\s\S]*td\.pq-td-qty \{ text-align: center !important; \}/);
    expect(screenCss).toMatch(/\.pq-th-price,[\s\S]*\.pq-th-total,[\s\S]*td\.pq-td-price,[\s\S]*td\.pq-td-total \{ text-align: right !important; \}/);
  });
});

describe('quoteDocument.css - live header mirrors the landing header', () => {
  it('uses the same 42/56 top grid, outer metadata rail and stacked issuer details on every screen quote', () => {
    const screenParityAt = css.indexOf('/* ---------- screen parity with the Owner-approved landing quotation');
    const outputModesAt = css.indexOf('/* ---------- header band: output modes');
    const screenCss = css.slice(screenParityAt, outputModesAt);
    expect(screenCss).toMatch(/\.pq-letterhead:not\(\.pq-letterhead-modern\) \.pq-lh-brandline \{[\s\S]*?grid-template-columns:\s*minmax\(0, 42%\) minmax\(0, 56%\);/);
    expect(screenCss).toMatch(/\.pq-letterhead:not\(\.pq-letterhead-modern\) \.pq-lh-band \.pq-meta \{[\s\S]*?width:\s*56%;[\s\S]*?margin-left:\s*0;[\s\S]*?margin-right:\s*auto;/);
    expect(screenCss).toMatch(/\.pq-page\[dir='ltr'\][^{}]*\.pq-meta \{\s*margin-left:\s*auto;\s*margin-right:\s*0;/);
    expect(screenCss).toMatch(/\.pq-lh-details \{\s*display:\s*block;/);
    expect(css).toMatch(/\.pq-letterhead \.pq-meta-label \{[^}]*min-height:\s*1\.3em;[^}]*white-space:\s*nowrap;/);
    expect(screenCss).toMatch(/\.pq-meta-cell \{\s*padding:\s*5px 4px;/);
    expect(css).toMatch(/\.pq-lh-details\[dir='rtl'\] \{\s*direction:\s*rtl;\s*text-align:\s*right;/);
  });
});

// cloud-fix3 (A6): native Print pagination, sample-page print, long amounts, quantity precision, print recipient (D12).
describe('cloud-fix3 - print end-of-document, standalone sample print, long amounts, quantities', () => {
  const printBlocks = css.split('@media print').slice(1).join('@media print');
  it('approval / expired status / footer never start a print page on their own (break-before: avoid, native Print only)', () => {
    expect(printBlocks).toMatch(/\.pq-page:not\(\.pq-preview\) \.pq-card \.pq-approval,\s*\.pq-page:not\(\.pq-preview\) \.pq-card \.pq-doc-status,\s*\.pq-page:not\(\.pq-preview\) \.pq-card \.pq-doc-foot \{\s*break-before: avoid;\s*page-break-before: avoid;\s*break-inside: avoid;/);
  });
  // Owner console 2026-10-18, typed: "זה חייב להראות בדיוק כמו המסך רק מבלי להדפיס את ההדר בשחור" - Print and the Direct PDF ARE the screen document
  it('A4 output = the screen document: the paper rules only drop the paper chrome (no frame / shadow / radius) and set NO font-size or line-height; the screen-parity rules govern print and the capture', () => {
    const a4 = css.slice(css.indexOf('/* ---------- A4 output = the screen document'), css.indexOf('/* ---------- creator preview frame'));
    expect(a4.length).toBeGreaterThan(400);
    expect(a4).toMatch(/@media print \{/);
    expect(a4).toMatch(/\n\.pq-pdf-capturing \.pq-card \{\s*border: 0 !important;\s*box-shadow: none !important;\s*border-radius: 0 !important;/);
    expect(css).not.toMatch(/\/\* ---------- A4 layout/);
    const parity = css.slice(css.indexOf('/* ---------- screen parity with the Owner-approved landing quotation'), css.indexOf('/* ---------- header band: output modes'));
    expect(parity).toMatch(/@media screen, print \{/);
    expect(parity.replace('.pq-page:not(.pq-pdf-capturing) .pq-card .pq-letterhead .pq-logo-chip img', '')).not.toMatch(/:not\(\.pq-pdf-capturing\)/);
    const decls = a4.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(decls).not.toMatch(/font-size|line-height|(^|[\s;{])font:/);
    // and no other print / capture rule in the file shrinks document type either
    const withoutScreenParity = css.replace(/\/\* ---------- screen parity with the Owner-approved landing quotation[\s\S]*?\/\* ---------- header band: output modes/, '/* ---------- header band: output modes');
    for (const m of withoutScreenParity.matchAll(/([^{}]*(?:\.pq-pdf-capturing|:not\(\.pq-preview\))[^{}]*)\{([^}]*)\}/g)) {
      expect(m[2], `print/capture font-size: ${m[1].trim()}`).not.toMatch(/font-size|line-height/);
    }
  });
  it('generateQuotePdf keeps the 718px document width (1 CSS px = 0.75pt, the native Print scale)', async () => {
    const m = await import('../utils/generateQuotePdf');
    expect(m.PDF_DOCUMENT_WIDTH_PX).toBe(718);
  });
  it.each(PAGES)('$name: previewMode embedded => .pq-preview and no print CSS; standalonePrint (sample route) => the A4 print contract', ({ Page, wrap, locale }) => {
    const sample = buildSampleQuote({ locale, style: 'classic', length: 'short', images: false, now: NOW });
    const mk = (props) => { const el = <Page quoteData={sample.quoteData} presentation={sample.presentation} previewMode {...props} />; return render(wrap ? <MemoryRouter>{el}</MemoryRouter> : el).container; };
    const embedded = mk({});
    expect(embedded.querySelector('.pq-page').className).toMatch(/pq-preview/);
    expect(embedded.querySelector('style').textContent).not.toMatch(/@page/);
    cleanup();
    const standalone = mk({ standalonePrint: true });
    expect(standalone.querySelector('.pq-page').className).not.toMatch(/(^|\s)pq-preview(\s|$)/);
    expect(standalone.querySelector('.pq-page').className).toMatch(/pq-standalone-preview/);
    expect(standalone.querySelector('style').textContent).toMatch(/@page/);
    // standalone visual-review sample shows the real screen action strip, but never the approval input/signature pad
    expect(standalone.querySelectorAll('.pq-action-tile')).toHaveLength(4);
    expect(standalone.querySelector('canvas')).toBeNull();
  });
  it.each(PAGES)('$name: long amounts mark the table pq-amounts-wide; a quantity keeps its decimals (3.375, never 3.38)', ({ Page, wrap, locale }) => {
    const sample = buildSampleQuote({ locale, style: 'classic', length: 'short', images: false, now: NOW });
    const items = sample.quoteData.items.map((it, i) => (i === 1 ? { ...it, calculated_quantity: 3.375, unit_price: 1250000, price: 1250000, total_price: 4218750 } : it));
    const el = <Page quoteData={{ ...sample.quoteData, items }} presentation={sample.presentation} />;
    const { container } = render(wrap ? <MemoryRouter>{el}</MemoryRouter> : el);
    const table = container.querySelector('.pq-card .pq-commercial-table');
    expect(table.classList.contains('pq-amounts-wide')).toBe(true);
    expect(container.querySelector('.pq-card .pq-td-qty').parentElement.parentElement.textContent).toContain('3.375');
    expect(container.querySelector('.pq-card').textContent).not.toContain('3.38 ');
    expect(container.querySelector('.pq-card').textContent).toContain('1,250,000.00');
    cleanup();
    const plain = buildSampleQuote({ locale, style: 'classic', length: 'short', images: false, now: NOW });
    const el2 = <Page quoteData={plain.quoteData} presentation={plain.presentation} />;
    const c2 = render(wrap ? <MemoryRouter>{el2}</MemoryRouter> : el2).container;
    expect(c2.querySelector('.pq-card .pq-commercial-table').classList.contains('pq-amounts-wide')).toBe(false);
    expect(c2.querySelector('.pq-card').textContent).toContain('3.40');
  });
  it('narrow screens: only a pq-amounts-wide table lays out content-aware; quantity values never break inside', () => {
    expect(css).toMatch(/@media \(max-width: 640px\) \{\s*\.pq-card \.pq-commercial-table\.pq-amounts-wide \{\s*table-layout: auto !important;/);
    expect(css).toMatch(/@container pq-preview \(max-width: 640px\) \{\s*\.pq-page\.pq-preview \.pq-commercial-table\.pq-amounts-wide \{\s*table-layout: auto !important;/);
    expect(css).toMatch(/\.pq-card \.pq-commercial-table td\.pq-td-qty \{\s*overflow-wrap: normal;/);
  });
});

// cloud-fix4 (A13): pointwise returns to base c65f742 - totals (D19), terms / notes (D20), footer (D23), expired /
// unfinished (D27) - and the empty attachments line contrast (Q5 kept at #64748b, measured >= 4.5:1).
describe('cloud-fix4 - base panels restored (ledger D19 / D20 / D23 / D27) + attachments empty-line contrast', () => {
  const rule = (sel) => { const m = css.match(new RegExp(`\\n${sel.replace(/[.[\]()'=]/g, (c) => `\\${c}`)} \\{([^}]*)\\}`)); expect(m, sel).toBeTruthy(); return m[1]; };
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const L = (hex) => { const [r, g, b] = rgb(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  it('D19 totals: base panel in every style, base sizes, violet amount, base print / capture border; no Modern-only panel', () => {
    const box = rule('.pq-card .pq-totals-box');
    for (const d of ['background: #faf9fd;', 'border: 1px solid #e4e1ee;', 'border-radius: 12px;', 'padding: 16px 20px;', 'max-width: 380px;', 'grid-template-columns: 1fr auto;']) expect(box).toContain(d);
    expect(rule('.pq-card .pq-total-label')).toMatch(/font-size: 0\.9rem;[\s\S]*color: #64748b;/);
    expect(rule('.pq-card .pq-total-final-label')).toMatch(/font-size: 1\.3rem;\s*font-weight: 900;\s*color: #1e293b;/);
    // IRON-NUMERIC-001 (local fix 6, R2): the final amount shares the rows' digit metrics (one size + weight variable);
    // emphasis = violet + a non-layout highlight + the 1.3rem / 900 label. A 1.3rem / 900 amount drifted 11.8-14.2px.
    const finalAmount = rule('.pq-card .pq-total-final-amount');
    expect(finalAmount).toMatch(/font-size: var\(--pq-total-amount-size\);\s*font-weight: var\(--pq-total-amount-weight, 400\);\s*color: #7c3aed;[\s\S]*box-shadow: 0 0 0 4px #f1ebff;[\s\S]*text-align: right;/);
    expect(css).not.toMatch(/-webkit-text-stroke/); // stroked text is written twice into the PDF text layer
    expect(finalAmount).not.toMatch(/font-size: (?!var)/);
    expect(rule('.pq-card .pq-total-value')).toMatch(/font-size: var\(--pq-total-amount-size\);\s*font-weight: var\(--pq-total-amount-weight, 400\);[\s\S]*text-align: right;/);
    expect(css).toMatch(/--pq-total-amount-size: 0\.9rem;/);
    expect(css).not.toMatch(/\.pq-style-modern \.pq-totals-box|\.pq-style-modern \.pq-total-final-amount|\.pq-body-aside \.pq-totals-box/);
    // Owner console 2026-10-18, typed: "זה חייב להראות בדיוק כמו המסך רק מבלי להדפיס את ההדר בשחור" - Print and the Direct PDF ARE the screen document
    // the paper keeps the screen totals (no separate bordered print / capture panel)
    expect(css).not.toMatch(/\.pq-totals-box \{\s*border: 1\.5px solid #0f172a/);
  });
  it.each(PAGES)('$name D19: every totals amount stays on one right axis inside ONE grid (locked)', (page) => {
    for (const style of STYLES) {
      const { container } = renderDoc(page, style);
      const boxes = container.querySelectorAll('.pq-card .pq-totals-box');
      expect(boxes.length).toBe(1);
      expect(boxes[0].style.gridTemplateColumns).toBe('1fr auto');
      boxes[0].querySelectorAll('.pf-money').forEach((m) => expect(m.parentElement).toBe(boxes[0]));
      cleanup();
    }
  });
  it('D20 terms / warranty / notes: base grey panels, stacked', () => {
    expect(rule('.pq-card .pq-doc-notes')).toMatch(/display: block;/);
    const note = rule('.pq-card .pq-doc-note');
    for (const d of ['margin: 0 0 25px;', 'padding: 15px 20px;', 'background: #f8fafc;', 'border: 1px solid #e2e8f0;', 'border-radius: 10px;']) expect(note).toContain(d);
    expect(rule('.pq-card .pq-doc-note-title')).toMatch(/font-size: 0\.85rem;\s*font-weight: 700;\s*color: #1e293b;/);
    expect(rule('.pq-card .pq-doc-note-body')).toMatch(/font-size: 0\.85rem;\s*line-height: 1\.5;\s*color: #475569;/);
  });
  it('D23 footer: base centred credit line 0.9rem #64748b, violet TEKANGO', () => {
    expect(rule('.pq-card .pq-doc-foot')).toMatch(/text-align: center;\s*font-size: 0\.9rem;\s*color: #64748b;/);
    expect(rule('.pq-card .pq-doc-credit')).toMatch(/color: #7c3aed;/);
  });
  it('D27 expired / unfinished: base orange panels', () => {
    const st = rule('.pq-card .pq-doc-status');
    for (const d of ['background: #fff7ed;', 'border: 1px solid #fed7aa;', 'border-radius: 12px;', 'color: #9a3412;', 'padding: 18px;', 'font-size: 0.95rem;', 'font-weight: 700;']) expect(st).toContain(d);
    expect(rule('.pq-card .pq-doc-status.pq-doc-status-unfinished')).toMatch(/padding: 16px;\s*font-size: 0\.92rem;/);
  });
  it('attachments empty line: base text, #64748b on the #f8fafc panel >= 4.5:1 on screen, and print / capture do not recolour it', () => {
    expect(rule('.pq-card .pq-attachments-empty')).toMatch(/color: #64748b;/);
    expect(rule('.pq-card .pq-attachments')).toMatch(/background: #f8fafc;/);
    expect(ratio('#64748b', '#f8fafc')).toBeGreaterThanOrEqual(4.5);
    const withoutScreenParity = css.replace(/\/\* ---------- screen parity with the Owner-approved landing quotation[\s\S]*?\/\* ---------- header band: output modes/, '/* ---------- header band: output modes');
    expect(withoutScreenParity).not.toMatch(/(pq-pdf-capturing|:not\(\.pq-preview\))[^{}]*\.pq-attachments(-empty)?[^{}]*\{[^}]*(color|background)/);
  });
  it('contrast (Owner round 4): discount #dc2626 on the #faf9fd totals panel and the print #b91c1c on #f8fafc are >= 4.5:1', () => {
    expect(rule('.pq-card .pq-discount-negative')).toMatch(/color: #dc2626;/);
    expect(ratio('#dc2626', '#faf9fd')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#b91c1c', '#f8fafc')).toBeGreaterThanOrEqual(4.5);
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/#ef4444/);
  });
  it('base table type (cloud-fix4): HE header 0.85rem / body 0.9rem; EN 1rem (header at document widths only, so the narrow rules keep theirs)', () => {
    expect(rule('.pq-card .pq-commercial-table')).toMatch(/font-size: 0\.9rem;/);
    expect(rule('.pq-card .pq-commercial-table th')).toMatch(/font-size: 0\.85rem;/);
    expect(rule(".pq-page[dir='ltr'] .pq-card .pq-commercial-table")).toMatch(/font-size: 1rem;/);
    expect(css).toMatch(/@media \(min-width: 641px\) \{\s*\.pq-page\[dir='ltr'\] \.pq-card \.pq-commercial-table th \{\s*font-size: 1rem;/);
    // no EN rule sets a td size (the <= 640px / <= 420px td rules must keep winning)
    expect(css).not.toMatch(/\.pq-page\[dir='ltr'\][^{}]*td[^{}]*\{[^}]*font-size/);
  });
  // Owner console 2026-10-18, typed: "זה חייב להראות בדיוק כמו המסך רק מבלי להדפיס את ההדר בשחור" - Print and the Direct PDF ARE the screen document
  it('paper: terms / notes keep the screen layout (no A4-only grid); the end group (.pq-doc-end) never splits in native Print', () => {
    expect(css).not.toMatch(/\.pq-doc-notes \{\s*display: grid !important;/);
    expect(css).toMatch(/\.pq-page:not\(\.pq-preview\) \.pq-card \.pq-doc-end \{\s*break-inside: avoid;/);
  });
  it.each(PAGES)('$name: the document ends with ONE group - last body block, approval record, footer - in every style', (page) => {
    for (const style of STYLES) {
      const { container } = renderDoc(page, style);
      const card = container.querySelector('.pq-card');
      const end = card.lastElementChild;
      expect(end.className).toBe('pq-doc-end');
      expect(end.firstElementChild.className).toMatch(/pq-doc-notes|pq-totals-wrap/);
      expect(end.querySelector('.pq-approval .pq-sigline')).not.toBeNull();
      expect(card.querySelectorAll('.pq-totals-box').length).toBe(1);
      expect(card.querySelectorAll('.pq-approval').length).toBe(1);
      cleanup();
    }
  });
  it('Owner 2026-10-06: the screen band is exact black with no gradient, radius 14 (compact 12); print / capture stay white', () => {
    expect(css).toMatch(/--pq-band-bg: #000000;/);
    expect(css).toMatch(/--pq-band-gradient: none;/);
    const band = rule('.pq-letterhead .pq-lh-band');
    expect(band).toMatch(/background-image: var\(--pq-band-gradient\);/);
    expect(band).toMatch(/border-radius: 14px;/);
    expect(rule('.pq-letterhead.pq-lh-mobile .pq-lh-band')).toMatch(/border-radius: 12px;/);
    expect(css).not.toMatch(/#24323C|#25353C/i);
    // the white print / capture rules use the background SHORTHAND, which also clears the gradient image
    expect(css).toMatch(/@media print \{\s*\.pq-letterhead \.pq-lh-band,\s*\.pq-letterhead\.pq-letterhead-modern \.pq-lh-band\.pq-modern-head \{\s*background: #FFFFFF !important;/);
    // Owner console 2026-10-18, typed: "זה חייב להראות בדיוק כמו המסך רק מבלי להדפיס את ההדר בשחור" - Print and the Direct PDF ARE the screen document
    expect(css).toMatch(/\n\.pq-pdf-capturing \.pq-letterhead \.pq-lh-band,\s*\.pq-pdf-capturing \.pq-letterhead\.pq-letterhead-modern \.pq-lh-band\.pq-modern-head \{\s*background: #FFFFFF !important;/);
    // the band keeps its screen geometry on paper (no padding: 0 / radius: 0 override of the white band)
    expect(css).not.toMatch(/\.pq-lh-band\.pq-modern-head \{[^}]*padding: 0/);
  });
  // Owner console 2026-10-18, typed: "זה חייב להראות בדיוק כמו המסך רק מבלי להדפיס את ההדר בשחור" - Print and the Direct PDF ARE the screen document
  it('screen metadata is monochrome white; only an actually expired state is pink; print / capture: the same monochrome values in dark ink', () => {
    expect(rule('.pq-letterhead .pq-lh-band .pq-meta-value.pq-header-number,\n.pq-letterhead .pq-lh-band .pq-visual-number b.pq-header-number')).toMatch(/color: var\(--pq-band-ink\);/);
    expect(rule('.pq-letterhead .pq-lh-band .pq-meta-value.pq-header-valid')).toMatch(/color: var\(--pq-band-ink\);/);
    expect(css).toMatch(/--pq-band-danger: #fca5a5;/);
    expect(ratio('#ffffff', '#000000')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#fca5a5', '#000000')).toBeGreaterThanOrEqual(4.5);
    expect(css).toMatch(/\.pq-pdf-capturing \.pq-letterhead \.pq-lh-band \.pq-meta-value\.pq-header-number,[^{]*\{\s*color: var\(--pq-ink\) !important;/);
    expect(css).toMatch(/\.pq-pdf-capturing \.pq-letterhead \.pq-lh-band \.pq-header-valid\.pq-is-expired,[^{]*\{\s*color: var\(--pq-danger\) !important;/);
    expect(css).not.toMatch(/color: #4338ca/);
  });
  it('G1: on phones (compact branch and <= 768px screens) the quote number inherits the base glass white rgba(255,255,255,.92)', () => {
    expect(css).toMatch(/\.pq-letterhead\.pq-lh-mobile \.pq-lh-band \.pq-meta-value\.pq-header-number \{\s*color: rgba\(255, 255, 255, 0\.92\);/);
    expect(css).toMatch(/@media screen and \(max-width: 768px\) \{\s*\.pq-letterhead \.pq-lh-band \.pq-meta-value\.pq-header-number,\s*\.pq-letterhead \.pq-lh-band \.pq-visual-number b\.pq-header-number \{\s*color: rgba\(255, 255, 255, 0\.92\);/);
  });
  it('Visual quote-number block is a centred metadata cell at every width (label and value centred, fidelity doc.metadataCentered)', () => {
    expect(rule('.pq-letterhead.pq-letterhead-visual .pq-visual-number')).toMatch(/text-align: center;/);
    expect(css).not.toMatch(/\.pq-visual-number \{\s*text-align: (start|end);/);
  });
  it('D36 item-table header: base #f1f5f9 / #475569 / bold in every style', () => {
    const th = rule('.pq-card .pq-commercial-table th');
    expect(th).toMatch(/font-weight: 700;/);
    expect(th).toMatch(/color: #475569;/);
    expect(th).toMatch(/background: #f1f5f9;/);
    expect(css).not.toMatch(/pq-style-visual \.pq-commercial-table th/);
    expect(ratio('#475569', '#f1f5f9')).toBeGreaterThanOrEqual(4.5);
  });
  it('<= 340px: only the totals panel inline inset (6px) and column gap (8px) tighten - a 10-digit grand total fits at 320px', () => {
    expect(css).toMatch(/@media \(max-width: 340px\) \{\s*\.pq-card \.pq-totals-box\.pq-section \{\s*padding-left: 6px !important;\s*padding-right: 6px !important;\s*column-gap: 8px;\s*\}\s*\}/);
  });
  // Owner console 2026-10-18, typed: "זה חייב להראות בדיוק כמו המסך רק מבלי להדפיס את ההדר בשחור" - Print and the Direct PDF ARE the screen document
  it('paper keeps the screen image sizes and the screen Modern / Visual composition (no A4-only media or letterhead overrides); print and capture identical, type untouched', () => {
    const a4 = css.slice(css.indexOf('/* ---------- A4 output = the screen document'), css.indexOf('/* ---------- creator preview frame'));
    expect(a4).not.toMatch(/pq-media|pq-modern-head|pq-meta-project/);
    const code = a4.replace(/\/\*[\s\S]*?\*\//g, '');
    // negative: the unapproved print shrink (stack hero as one 100px row, 76px rail) must not come back
    expect(code).not.toMatch(/pq-media-hero--stack/);
    expect(code).not.toMatch(/--pq-hero-h: (?!190px)\d+px/);
    expect(code).not.toMatch(/\b76px\b/);
    expect(code).not.toMatch(/display: none|visibility: hidden|font-size|line-height/);
  });
  it('Call CTA (D21b): screen only - hidden in print and while capturing', () => {
    expect(css).toMatch(/@media print \{\s*\.pq-letterhead \.pq-lh-call \{\s*display: none !important;/);
    expect(css).toMatch(/\n\.pq-pdf-capturing \.pq-letterhead \.pq-lh-call \{\s*display: none !important;/);
    // Owner 2026-10-07: the call action stays in the physical outer corner of the screen band.
    expect(rule('.pq-letterhead .pq-lh-call')).toMatch(/justify-content: flex-end;/);
  });
});
