import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicQuote from './PublicQuote';
import PublicQuoteEn from './PublicQuoteEn';
import { supabase } from '../shared/supabase';
import { buildSampleQuote } from '../quoteDocument/sampleQuotes';

// Task 16 - Quote Experience V2 (CONTRACT §4): document/action separation, the three compositions selected by
// presentation.style (absent => legacy Classic), issued-branding override and previewMode isolation.
vi.mock('../shared/supabase', () => ({
  supabase: { rpc: vi.fn().mockResolvedValue({ error: null }), functions: { invoke: vi.fn() } },
}));

const NOW = new Date('2026-10-04T09:00:00Z');

function heData(overrides = {}) {
  const { quoteData } = buildSampleQuote({ locale: 'he', now: NOW });
  return {
    ...quoteData,
    business: { ...quoteData.business, phone: '0501234567', ...overrides.business },
    quote: { ...quoteData.quote, ...overrides.quote },
  };
}
function enData(overrides = {}) {
  const { quoteData } = buildSampleQuote({ locale: 'en', now: NOW });
  return {
    ...quoteData,
    business: { ...quoteData.business, phone: '+15035550100', ...overrides.business },
    quote: { ...quoteData.quote, ...overrides.quote },
  };
}
const renderHe = (props) => render(<MemoryRouter><PublicQuote {...props} /></MemoryRouter>);
// PublicQuoteEn is rendered WITHOUT a Router on purpose (it must never navigate).
const renderEn = (props) => render(<PublicQuoteEn {...props} />);

const PAGES = [
  ['HE', renderHe, heData, { print: 'הדפסת המסמך', sign: 'חתימת לקוח לאישור ההצעה:', approve: /אישור וחתימה/ }],
  ['EN', renderEn, enData, { print: 'Print Document', sign: 'Client Signature to Approve This Quote:', approve: /Approve & Sign/ }],
];

beforeEach(() => {
  supabase.rpc.mockClear();
  document.documentElement.dir = '';
  document.documentElement.lang = '';
});

describe.each(PAGES)('%s public quote - document / action separation', (name, renderPage, data, t) => {
  const locale = name === 'HE' ? 'he' : 'en';
  // Owner 2026-10-18 ("להחזיר את כל מה ששונה ללא אישור שלי עכשיו!!!!!!", docs/OWNER_LOST_BEHAVIOURS_2026-10-18.md) #18: the signature pad is back INSIDE the document (D22 / D21a were reviewer rulings, not Owner sentences)
  it('the action tiles are INSIDE the card at the base position (after the approval record, above the footer) and never reach an output (no-print + data-html2canvas-ignore); the signature pad is inside the document before them', () => {
    const { container } = renderPage({ quoteData: data() });
    const card = container.querySelector('.pq-card');
    expect(container.querySelectorAll('.pq-card').length).toBe(1);
    const tiles = card.querySelector('.pq-action-tiles');
    expect(tiles).not.toBeNull();
    expect(tiles.className).toMatch(/no-print/);
    expect(tiles.getAttribute('data-html2canvas-ignore')).toBe('true');
    expect(tiles.querySelectorAll('.pq-action-tile').length).toBe(4);
    const end = card.querySelector('.pq-doc-end');
    expect(tiles.parentElement).toBe(end);
    const approval = card.querySelector('.pq-approval');
    expect(approval.compareDocumentPosition(tiles) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const foot = card.querySelector('.pq-doc-foot');
    if (foot) expect(tiles.compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    else expect(end.lastElementChild).toBe(tiles);
    // #18: the signature pad sits inside the document end, after the approval line and before the tiles - app UI only
    const pad = card.querySelector('.pq-actions-in-doc');
    expect(pad).not.toBeNull();
    expect(pad.className).toMatch(/no-print/);
    expect(pad.getAttribute('data-html2canvas-ignore')).toBe('true');
    expect(pad.parentElement).toBe(end);
    expect(pad.querySelector('canvas')).not.toBeNull();
    expect(approval.compareDocumentPosition(pad) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pad.compareDocumentPosition(tiles) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll('canvas').length).toBe(1);
    // every tel: link inside the card is screen-only app UI (header Call CTA, Call tile)
    const tels = [...card.querySelectorAll('a[href^="tel:"]')];
    expect(tels.length).toBe(2);
    tels.forEach((a) => expect(a.closest('.no-print[data-html2canvas-ignore="true"]')).not.toBeNull());
    const call = card.querySelector('.pq-lh-call');
    expect(call.className).toMatch(/no-print/);
    expect(call.getAttribute('data-html2canvas-ignore')).toBe('true');
    expect(call.closest('.pq-lh-band')).not.toBeNull();
    expect([...card.querySelectorAll('input')].every((i) => pad.contains(i))).toBe(true);
    // no second signature pad outside the card
    expect([...container.querySelectorAll('.pq-actions')].some((a) => !card.contains(a))).toBe(false);
    expect(pad.querySelector('.pq-action-tiles')).toBeNull();
    expect(screen.getByText(t.print)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.approve })).toBeInTheDocument();
    // The printed / PDF copy keeps the static approval line (print-only on screen).
    expect(card.querySelector('.pq-approval.pq-print-only .pq-sigline')).not.toBeNull();
    // ledger D23 (cloud-fix4): base footer - HE credit line only; EN has no footer (as base c65f742)
    if (name === 'HE') {
      expect(card.querySelector('.pq-doc-foot').textContent).toMatch(/^המסמך הופק באמצעות/);
      expect(card.querySelector('.pq-doc-foot').textContent).not.toContain(data().business.business_name);
    } else {
      expect(card.querySelector('.pq-doc-foot')).toBeNull();
    }
    // The page shell keeps the print/PDF hooks.
    const page = container.querySelector('.pq-page');
    expect(page.getAttribute('data-print-mode')).toBe('compact');
    expect(page.getAttribute('dir')).toBeTruthy();
  });

  it('a signed quote keeps its read-only approval record + signature image INSIDE the document', () => {
    const { container } = renderPage({ quoteData: data({ quote: { status: 'approved', signature: 'data:image/png;base64,iVBORw0KGgo=' } }) });
    const card = container.querySelector('.pq-card');
    expect(card.querySelector('img[alt="Client Signature"]')).not.toBeNull();
    expect(card.querySelector('.pq-approval-signed')).not.toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('presentation absent => legacy Classic (white letterhead, no media even if a payload carried some)', () => {
    const { container } = renderPage({ quoteData: data() });
    expect(container.querySelector('.pq-card').className).toMatch(/pq-style-classic/);
    expect(container.querySelector('.pq-letterhead-classic .pq-lh-rule')).not.toBeNull();
    expect(container.querySelector('.pq-media')).toBeNull();
    const { container: c2 } = renderPage({ quoteData: data(), presentation: { mode: 'draft', style: 'classic', media: buildSampleQuote({ style: 'modern' }).presentation.media } });
    expect(c2.querySelector('.pq-media')).toBeNull();
  });

  it('an unknown style or malformed presentation falls back to Classic', () => {
    const { container } = renderPage({ quoteData: data(), presentation: { mode: 'draft', style: 'neon', media: 'x' } });
    expect(container.querySelector('.pq-card').className).toMatch(/pq-style-classic/);
  });

  it('Modern: editorial header, product rail, row thumbnails INSIDE the description cell, still exactly four columns', () => {
    const media = buildSampleQuote({ locale, style: 'modern' }).presentation.media;
    const { container } = renderPage({ quoteData: data(), presentation: { mode: 'draft', style: 'modern', media } });
    expect(container.querySelector('.pq-card').className).toMatch(/pq-style-modern/);
    expect(container.querySelector('.pq-letterhead-modern')).not.toBeNull();
    expect(container.querySelector('.pq-card .pq-media-rail')).not.toBeNull();
    expect(container.querySelector('.pq-body-grid .pq-body-aside .pq-totals-box')).not.toBeNull();
    const table = container.querySelector('table.pq-commercial-table');
    expect(table.querySelectorAll('colgroup col').length).toBe(4);
    const thumbs = table.querySelectorAll('.pq-media-thumb');
    expect(thumbs.length).toBeGreaterThan(0);
    thumbs.forEach((th) => expect(th.closest('td').classList.contains('pq-td-desc')).toBe(true));
    table.querySelectorAll('tbody tr').forEach((tr) => expect(tr.querySelectorAll('td').length).toBe(4));
  });

  it('Visual: hero media + the same complete four-column table and totals', () => {
    const media = buildSampleQuote({ locale, style: 'visual' }).presentation.media;
    const { container } = renderPage({ quoteData: data(), presentation: { mode: 'draft', style: 'visual', media } });
    expect(container.querySelector('.pq-letterhead-visual')).not.toBeNull();
    expect(container.querySelector('.pq-card .pq-media-hero')).not.toBeNull();
    expect(container.querySelectorAll('table.pq-commercial-table tbody tr').length).toBe(3);
    expect(container.querySelector('.pq-totals-box')).not.toBeNull();
  });

  it('no images => the media area is omitted entirely (no empty boxes, no "no images" copy)', () => {
    const { container } = renderPage({ quoteData: data(), presentation: { mode: 'draft', style: 'visual', media: [] } });
    expect(container.querySelector('.pq-media')).toBeNull();
    expect(container.querySelector('.pq-card').className).toMatch(/pq-style-visual/);
  });

  // Owner 2026-10-18 ("להחזיר את כל מה ששונה ללא אישור שלי עכשיו!!!!!!", docs/OWNER_LOST_BEHAVIOURS_2026-10-18.md) #25: the business details are the LIVE settings again (a changed phone reaches the call / WhatsApp actions)
  it('the LIVE business details win over an issued snapshot; the snapshot only fills a field the live settings do not have; a draft ignores it', () => {
    const branding = { business_name: 'Frozen Name Ltd', logo_url: null, tax_id: '999', email: 'frozen@example.com', phone: null, address: null };
    const { container } = renderPage({ quoteData: data(), presentation: { mode: 'issued', style: 'classic', branding, media: [] } });
    expect(container.querySelector('.pq-letterhead').textContent).toContain(data().business.business_name);
    expect(container.querySelector('.pq-letterhead').textContent).not.toContain('Frozen Name Ltd');
    // the live phone is kept although the snapshot has none -> the call actions stay
    expect(container.querySelector('a[href^="tel:"]')).not.toBeNull();
    const base = data();
    const { container: c1 } = renderPage({ quoteData: { ...base, business: { ...base.business, email: null } }, presentation: { mode: 'issued', style: 'classic', branding, media: [] } });
    expect(c1.querySelector('.pq-letterhead').textContent).toContain('frozen@example.com');
    const { container: c2 } = renderPage({ quoteData: data(), presentation: { mode: 'draft', style: 'classic', branding, media: [] } });
    expect(c2.querySelector('.pq-letterhead').textContent).not.toContain('Frozen Name Ltd');
  });

  // Subscriptions continuation (C) - found by the real local stack journey: on a capability document (the immutable issued
  // snapshot) the snapshot business block, incl. the read-back verified logo, is authoritative over presentation branding.
  it('a capability snapshot document shows its verified issued logo even when presentation branding has no logo URL', () => {
    const logo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVQI12NgYGAAAAAEAAEnNCcKAAAAAElFTkSuQmCC';
    const branding = { business_name: 'Issued Name', logo_url: null, tax_id: null, email: null, phone: null, address: null };
    const base = data();
    const { container } = renderPage({ quoteData: { ...base, capability: true, business: { ...base.business, logo_url: logo } }, presentation: { mode: 'issued', style: 'classic', branding, media: [] } });
    expect([...container.querySelectorAll('img')].some((i) => i.getAttribute('src') === logo)).toBe(true);
  });

  it('previewMode: no signing pad / approve / tiles / print chooser, a neutral preview notice, no print CSS, no host-document side effects', () => {
    const { container } = renderPage({ quoteData: data({ quote: { is_owner_viewing: true } }), previewMode: true });
    expect(container.querySelector('canvas')).toBeNull();
    expect(screen.queryByRole('button', { name: t.approve })).toBeNull();
    expect(container.querySelector('.pq-action-tiles')).toBeNull();
    expect(screen.queryByText(t.print)).toBeNull();
    expect(screen.getByTestId('pq-preview-notice')).toBeInTheDocument();
    const css = container.querySelector('style').textContent;
    expect(css).not.toMatch(/@media print/);
    expect(css).not.toMatch(/@page/);
    expect(container.querySelector('.pq-page').className).toMatch(/pq-preview/);
    expect(container.querySelector('.pq-page').style.minHeight).not.toBe('100vh');
    expect(document.documentElement.dir).toBe('');
    expect(document.documentElement.lang).toBe('');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('attachments: always in the document (base c65f742, retro audit R-5) - empty-state line when there are none, links when there are', () => {
    const { container } = renderPage({ quoteData: data() });
    const empty = container.querySelector('.pq-card .pq-attachments');
    expect(empty).not.toBeNull();
    expect(empty.querySelector('.pq-attachments-title').textContent).toContain(name === 'HE' ? 'קבצים ושרטוטים מצורפים להצעה:' : 'Attached Files & Documents:');
    // base container (ledger D17, cloud-fix3) - not the fine-ruled document note
    expect(empty.classList.contains('pq-doc-note')).toBe(false);
    expect(empty.querySelector('.pq-attachments-empty').textContent).toBe(name === 'HE' ? 'אין קובץ מצורף להצעה זו' : 'No attachment included with this quote.');
    expect(empty.querySelector('a')).toBeNull();
    const withFiles = { ...data(), attachments: [{ url: 'https://example.com/plan.pdf', file_name: 'plan.pdf' }] };
    const { container: c2 } = renderPage({ quoteData: withFiles });
    const block = c2.querySelector('.pq-card .pq-attachments');
    expect(block).not.toBeNull();
    expect(block.querySelector('a[href="https://example.com/plan.pdf"]').textContent).toContain('plan.pdf');
    expect(block.querySelector('.pq-attachments-empty')).toBeNull();
  });

  it('Expanded on a FLAT quote shows NO detail lines under the rows (base c65f742 / master plan decision 4, ledger D26) and never changes an amount', () => {
    const base = data();
    const items = base.items.map((it, i) => (i === 1 ? { ...it, measurements: [{ width: 2, height: 1.7, unit: 'm', calculated_area: 3.4 }], specification: [{ label: 'Finish', value: 'Oil' }] } : it));
    const flat = { ...base, items };
    const compact = renderPage({ quoteData: flat, detail: 'compact' }).container;
    const moneyOf = (c) => [...c.querySelectorAll('.pq-card .pf-money')].map((e) => e.textContent);
    const compactMoney = moneyOf(compact);
    expect(compact.textContent).not.toContain('Finish: Oil');
    const expanded = renderPage({ quoteData: flat, detail: 'expanded' }).container;
    expect(expanded.querySelector('.pq-page').getAttribute('data-print-mode')).toBe('expanded');
    expect(expanded.textContent).not.toContain('Finish: Oil');
    expect(expanded.querySelector('.pq-td-desc .pq-item-detail')).toBeNull();
    expect(expanded.textContent).not.toMatch(/2.00 × 1.70/);
    expect(moneyOf(expanded)).toEqual(compactMoney);
    // still four cells per row, no extra column
    expanded.querySelectorAll('table.pq-commercial-table tbody tr').forEach((tr) => expect(tr.querySelectorAll('td').length).toBe(4));
  });

  it('outside previewMode the page still emits its print CSS', () => {
    const { container } = renderPage({ quoteData: data() });
    expect(container.querySelector('style').textContent).toMatch(/@media print/);
  });

  it('detail="expanded" (or presentation.detail in previewMode) opens the Expanded document detail (flat rows stay description-only)', () => {
    const { container } = renderPage({ quoteData: data(), previewMode: true, presentation: { mode: 'draft', style: 'classic', media: [], detail: 'expanded' } });
    expect(container.querySelector('.pq-page').getAttribute('data-print-mode')).toBe('expanded');
    // ledger D26: Expanded is professional-detail visibility of SECTION rows; a flat quote shows no detail lines
    expect(container.querySelectorAll('.pq-item-detail').length).toBe(0);
    const { container: c2 } = renderPage({ quoteData: data(), detail: 'compact' });
    expect(c2.querySelectorAll('.pq-item-detail').length).toBe(0);
  });
});

describe('PublicQuoteHeader Call CTA (Owner 2026-10-07: upper outer corner, screen only)', () => {
  const STYLES3 = ['classic', 'modern', 'visual'];
  it.each(STYLES3)('HE %s: "התקשרות לעסק" precedes metadata in the upper outer corner, tel: link without the number as text', (style) => {
    const { container } = renderHe({ quoteData: heData(), presentation: { mode: 'draft', style, media: [] } });
    const header = container.querySelector('.pq-letterhead');
    const call = header.querySelector('.pq-lh-call');
    expect(call).not.toBeNull();
    const a = call.querySelector('a[href^="tel:"]');
    expect(a.getAttribute('href')).toBe('tel:0501234567');
    expect(a.textContent).toBe('התקשרות לעסק');
    // It is structurally before metadata: Classic/Visual place it in the brandline corner; Modern starts the aside with it.
    const meta = header.querySelector('.pq-meta');
    expect(call.compareDocumentPosition(meta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(call.className).toMatch(/no-print/);
    expect(call.getAttribute('data-html2canvas-ignore')).toBe('true');
    // the business phone also stays in the issuer details as plain text
    const details = header.querySelector('.pq-lh-details');
    expect(details.getAttribute('dir')).toBe('rtl');
    const phone = details.querySelector('.pq-lh-phone');
    // Owner 2026-10-18 ("להחזיר את כל מה ששונה ללא אישור שלי עכשיו!!!!!!", docs/OWNER_LOST_BEHAVIOURS_2026-10-18.md) #21: the label "טלפון:" precedes the number again
    expect(phone.textContent).toMatch(/^טלפון:\s*050-?1234567$/);
    expect(phone.querySelector('bdi[dir="ltr"]')).not.toBeNull();
  });
  it('EN: "Call me"; no business phone => no CTA (base)', () => {
    const { container } = renderEn({ quoteData: enData() });
    expect(container.querySelector('.pq-lh-call a').textContent).toBe('Call me');
    const { container: c2 } = renderEn({ quoteData: enData({ business: { phone: null } }) });
    expect(c2.querySelector('.pq-lh-call')).toBeNull();
    expect(c2.querySelector('a[href^="tel:"]')).toBeNull();
  });
  it('ink #0369a1 (>= 4.5:1 on the white pill; base LIGHT.sky was 3.68:1) and >= 12px in every branch (screen floor)', () => {
    window.matchMedia = vi.fn().mockImplementation((q) => ({ matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
    const { container } = renderHe({ quoteData: heData() });
    const a = container.querySelector('.pq-letterhead.pq-lh-mobile .pq-lh-call a');
    expect(a).not.toBeNull();
    expect(a.style.color).toBe('rgb(3, 105, 161)');
    expect(parseFloat(a.style.fontSize) * 16).toBeGreaterThanOrEqual(12);
    cleanup();
    window.matchMedia = vi.fn().mockImplementation((q) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
    const { container: c2 } = renderEn({ quoteData: enData() });
    expect(parseFloat(c2.querySelector('.pq-lh-call a').style.fontSize) * 16).toBeGreaterThanOrEqual(12);
  });
});

// Owner 2026-10-18 ("להחזיר את כל מה ששונה ללא אישור שלי עכשיו!!!!!!", docs/OWNER_LOST_BEHAVIOURS_2026-10-18.md) #20: the phone document is the real phone width again, no paper frame ("Mobile near-full-width behavior", PROFLOW_TODO
// phone acceptance); the "Owner 2026-10-06" frame label had no Owner sentence on disk
describe('phone shell: the real phone width without a paper frame, section/table insets kept', () => {
  it.each([['HE', renderHe, heData], ['EN', renderEn, enData]])('%s: <= 640px uses the full-width shell and preserves section/table insets', (_n, renderPage, data) => {
    const { container } = renderPage({ quoteData: data() });
    const css = container.querySelector('style').textContent;
    const phone = css.slice(css.indexOf('@media (max-width: 640px)'));
    expect(phone).toMatch(/\.pq-page \{\s*padding: 4px !important;\s*\}/);
    expect(phone).toMatch(/\.pq-card \{\s*padding: 2px !important;\s*background: transparent !important;\s*box-shadow: none !important;\s*border: none !important;\s*border-radius: 0 !important;\s*\}/);
    expect(phone).toMatch(/\.pq-section \{\s*padding: 10px 12px !important;\s*\}/);
    expect(phone).toMatch(/\.pq-recipient \{\s*padding: 6px 10px !important;\s*margin-bottom: 10px !important;\s*\}/);
    expect(phone).not.toMatch(/padding: 18px 14px/);
    // the totals panel is a .pq-section (so it receives the base phone inset)
    expect(container.querySelector('.pq-totals-box').classList.contains('pq-section')).toBe(true);
  });
});

// Owner console 2026-10-18, typed: "אני רוצה שהוא יהיה בדיוק כמו הגודל שהוא עכשיו בלייף" (L-26): the document keeps the LIVE size and frame
describe('Owner 2026-10-06: real quote uses the landing sample paper frame', () => {
  it.each([['HE', renderHe, heData], ['EN', renderEn, enData]])('%s: pale frame and landing paper shadow', (_n, renderPage, data) => {
    const card = renderPage({ quoteData: data() }).container.querySelector('.pq-card');
    expect(card.style.border).toMatch(/18px solid (?:#dfe8e5|rgb\(223, 232, 229\))/);
    expect(card.style.boxShadow).toMatch(/0px 9px 28px rgba\(16, 29, 35, 0\.11\)|0 9px 28px rgba\(16,\s*29,\s*35,\s*0\.11\)/);
    expect(card.parentElement.style.maxWidth).toBe('830px');
    expect(830 - (2 * 18)).toBe(794); // A4 CSS width at 96dpi, excluding the decorative screen-only frame.
  });
});

describe('ledgers D08 / D25b (cloud-fix4)', () => {
  it('EN: "Valid:" on phones (compact branch), "Valid until" at document widths', () => {
    window.matchMedia = vi.fn().mockImplementation((q) => ({ matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
    const { container } = renderEn({ quoteData: enData() });
    expect(container.querySelector('.pq-meta-valid .pq-meta-label').textContent).toBe('Valid:');
    cleanup();
    window.matchMedia = vi.fn().mockImplementation((q) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
    const { container: c2 } = renderEn({ quoteData: enData() });
    expect(c2.querySelector('.pq-meta-valid .pq-meta-label').textContent).toBe('Valid until');
  });
  it.each([['HE', renderHe, heData], ['EN', renderEn, enData]])('%s: base page tone #f8fafc and landing frame radius 22px', (_n, renderPage, data) => {
    const { container } = renderPage({ quoteData: data() });
    expect(container.querySelector('.pq-page').style.background).toBe('rgb(248, 250, 252)');
    expect(container.querySelector('.pq-card').style.borderRadius).toBe('22px');
  });
});

describe('Owner 2026-10-06: screen title/subtitle follow the approved landing document', () => {
  it.each(['classic', 'modern', 'visual'])('HE %s: h1 includes the subject below the band; the preserved output subject remains in the client record', (style) => {
    const { container } = renderHe({ quoteData: heData(), presentation: { mode: 'draft', style, media: [] } });
    const subject = heData().quote.subject;
    expect(subject).toBeTruthy();
    expect(container.querySelector('h1.pq-doc-title').textContent).toBe(`הצעת מחיר · ${subject}`);
    expect(container.querySelector('.pq-screen-doc-subtitle').textContent).toBe(heData().quote.project_name);
    const s = container.querySelector('[data-role="client"] .pq-recipient-subject');
    expect(s.querySelector('.pq-recipient-subject-label').textContent).toBe('נושא ההצעה: ');
    expect(s.querySelector('.pq-recipient-subject-value').textContent).toBe(subject);
  });
  it('EN: h1 includes the subject and the project is the screen subtitle', () => {
    const { container } = renderEn({ quoteData: enData() });
    expect(container.querySelector('h1.pq-doc-title').textContent).toBe(`Price Quote · ${enData().quote.subject}`);
    expect(container.querySelector('.pq-screen-doc-subtitle').textContent).toBe(enData().quote.project_name);
    const s = container.querySelector('[data-role="client"] .pq-recipient-subject');
    expect(s.textContent).toBe(`Subject: ${enData().quote.subject}`);
  });
});

describe('ledger D27 (cloud-fix4): expired / unfinished states are base orange panels INSIDE the document', () => {
  it.each([['HE', renderHe, heData], ['EN', renderEn, enData]])('%s: expired record and the not-signable unfinished notice are in .pq-card', (_n, renderPage, data) => {
    const { container } = renderPage({ quoteData: data({ quote: { valid_until: '2020-01-01' } }) });
    const card = container.querySelector('.pq-card');
    expect(card.querySelector('[data-testid="pq-expired"]').className).toMatch(/pq-doc-status/);
    cleanup();
    const unfinished = data({ quote: { total: 0, subtotal: 0 } });
    unfinished.items = [];
    const { container: c2 } = renderPage({ quoteData: unfinished });
    const notice = c2.querySelector('[data-testid="pq-unfinished-nosign"]');
    expect(notice).not.toBeNull();
    expect(c2.querySelector('.pq-card').contains(notice)).toBe(true);
    expect(notice.className).toMatch(/pq-doc-status-unfinished/);
    expect(c2.querySelector('.pq-actions')?.contains(notice) ?? false).toBe(false);
  });
});
