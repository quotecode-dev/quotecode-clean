import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '@testing-library/react';
import AdminProtectedDialog from './components/AdminProtectedDialog';
import { getQuotesShowAll, setQuotesShowAll, resetQuotesListMemory } from './utils/quotesListMemory';
import { isQuoteAcceptanceExpired } from './utils/quoteValidity';
import { canonicalMarket } from './utils/regionConfig';

// LOCK GUARDS L-23 / L-24 / L-25 (scripts/governance/OWNER_LOCKED_FIXES_2026-10-15.md). Owner console 2026-10-18, typed:
// "להחזיר את כל מה ששונה ללא אישור שלי עכשיו!!!!!!" (docs/OWNER_LOST_BEHAVIOURS_2026-10-18.md) and "אחרי תיקון לנעול!!!!".
// A failing guard means the change is wrong, never the test (register rule 3).
const SRC = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(SRC, p), 'utf8').split(String.fromCharCode(13)).join('');

describe('L-23 the quote list, editor, catalog, finances (reverted behaviours)', () => {
  const dash = read('pages/Dashboard.jsx');
  const tab = read('components/QuotesTab.jsx');
  it('#1 the CSV export is visible on the desktop list (a compact 36px icon)', () => {
    // + L-26 ("את היצוא לאקסל למקם מימין למיון"): the first toolbar control, level with the 32px controls beside it
    expect(dash).toContain('.quote-export-compact { display: inline-flex; align-items: center; justify-content: center; inline-size: 32px; block-size: 32px;');
    expect(tab.indexOf('className="quote-export-compact"')).toBeLessThan(tab.indexOf('className="quote-sort-direction"'));
    expect(tab.indexOf('<div className="quote-workspace-controls">')).toBeLessThan(tab.indexOf('className="quote-export-compact"'));
    expect(dash).not.toMatch(/\.quote-export-compact \{ display: none; \}/);
  });
  it('#2 "show all" is remembered while the app is open; a search shows every match', () => {
    resetQuotesListMemory();
    expect(getQuotesShowAll()).toBe(false);
    setQuotesShowAll(true);
    expect(getQuotesShowAll()).toBe(true);
    resetQuotesListMemory();
    expect(tab).toContain('useState(() => getQuotesShowAll());');
    expect(tab).toContain("const showAllDesktopQuotes = showAllDesktopQuotesState || !!String(searchTerm || '').trim();");
  });
  it('#3 with no hot quote the banner says so (the Owner copy of 2026-09-08)', () => {
    expect(tab).toContain("{!hotLead && !quotesNotLoaded && (");
    expect(tab).toContain("'אין כרגע הצעה חמה'");
    expect(tab).toContain("'כשהצעה תיצפה 3 פעמים או יותר ועדיין לא תאושר, היא תופיע כאן.'");
  });
  it('#4 the hot banner reads every quote; a hot quote hidden by a search / filter opens its public view', () => {
    expect(tab).toContain('const hotSource = (Array.isArray(allQuotes) && allQuotes.length ? allQuotes : quotes) || [];');
    expect(tab).toContain("if (q && typeof window !== 'undefined') window.open(getQuoteViewLink(q), '_blank');");
  });
  it('#5 the phone filter sheet uses the same shown-status options as the desktop', () => {
    expect(tab).toContain('{QUOTE_FILTER_OPTIONS.map((f) => <option key={f} value={f}>{quoteFilterLabel(f, isHebrew)}</option>)}');
  });
  it('#8 the save / error toast is centred over the workspace (half of the 178px sidebar)', () => {
    expect(dash).toContain("left: calc(50% ${isHebrew ? '- 89px' : '+ 89px'});");
  });
  it('#13 the measured-quote hint promises no rooms', () => {
    expect(read('utils/newQuoteChoices.js')).toContain("hint: isHebrew ? 'מידות, יחידות ומחירים לפי המקצוע שלך' : 'Sizes, units and prices for your trade',");
  });
  it('#14 the catalog row buttons show their words (icon + text, 44px)', () => {
    const c = read('components/ServicesCatalog.jsx');
    for (const w of ["'שמור' : 'Save'", "'ביטול' : 'Cancel'", "'ערוך' : 'Edit'", "'מחק' : 'Delete'"]) expect(c).toContain(`<span aria-hidden="true">{isHebrew ? ${w}}</span>`);
    expect(read('components/servicesCatalog.css')).toContain('.svc-cat-btn.svc-cat-btn--text { width: auto;');
  });
  it('#16 four clearly different income colours', () => {
    expect(read('components/FinancesTab.jsx')).toContain("const INCOME_FILLS = ['#22c55e', '#0ea5e9', '#8b5cf6', '#f59e0b'];");
  });
  it('#17 the plans window gets the account currency (the EUR / GBP estimate line)', () => {
    expect(dash).toMatch(/isLifetime=\{isLifetimeAccount\}\n[^\n]*#17[^\n]*\n\s*currency=\{currency\}/);
  });
});

describe('L-24 the public quote (reverted behaviours)', () => {
  const pages = [['HE', read('pages/PublicQuote.jsx')], ['EN', read('pages/PublicQuoteEn.jsx')]];
  it.each(pages)('%s #18 the signature pad is inside the document after the terms (app UI only); the static line is print / PDF only', (_n, s) => {
    expect(s).toContain('const signInDoc = !!signArea && !previewMode && !approved && !isOwnerViewing && !isUnfinishedDraft && !isExpired;');
    expect(s).toContain('{signInDoc ? <div className="pq-actions pq-actions-in-doc no-print" data-html2canvas-ignore="true">{signArea}</div> : null}');
    expect(s).toContain('{signArea && !signInDoc ? (');
    expect(s).toContain('pq-section pq-approval pq-print-only');
  });
  it.each(pages)('%s #20 phone: full width, no paper frame; #22 tiles 92px (phone 78px); #24 one notice for an unfinished draft; #25 live business details', (_n, s) => {
    expect(s).toMatch(/\.pq-card \{\{?\s*padding: 2px !important;\s*background: transparent !important;\s*box-shadow: none !important;\s*border: none !important;\s*border-radius: 0 !important;/);
    expect(s).toMatch(/min-height: 92px;\s*padding: 14px 8px;\s*border-radius: 16px;/);
    expect(s).toMatch(/\.pq-action-tile \{\s*min-height: 78px !important;\s*padding: 10px 4px !important;/);
    expect(s).toContain('} else if (isExpired && !isUnfinishedDraft) {');
    expect(s).toContain('const brand = { ...(issuedBranding || {}), ...liveBusiness };');
  });
  it('#19 the signed confirmation is the green box; #18 print-only rule', () => {
    const css = read('quoteDocument/quoteDocument.css');
    expect(css).toMatch(/\.pq-card \.pq-approval-signed \{\s*display: block;\s*background: #dcfce7;\s*color: #166534;/);
    expect(css).toContain('.pq-card .pq-print-only { display: none; }');
    expect(css).toContain('@media print { .pq-card .pq-print-only { display: flex !important; } }');
  });
  it('#21 the "Phone:" label precedes the number; #23 the page shows at once (no presentation wait)', () => {
    expect(read('components/PublicQuoteHeader.jsx')).toContain('{bizPhone && <div className="pq-lh-phone">{L.phone} <bdi dir="ltr">{bizPhone}</bdi></div>}');
    const smart = read('components/SmartPublicQuote.jsx');
    expect(smart).not.toMatch(/Promise\.race\(\[presentationPromise/);
    expect(smart).not.toMatch(/const PRESENTATION_WAIT_MS/);
  });
});

describe('L-25 one market rule (Codex LANG-01 / LANG-02) and the admin dialog background (AV-04)', () => {
  it('LANG-01: an unknown stored country is International everywhere; the stored value is kept on save', () => {
    const dash = read('pages/Dashboard.jsx');
    expect(dash).toContain("const countryVal = canonicalMarket(data.country) || 'International';");
    expect(dash).toContain("country: storedCountryRef.current && (canonicalMarket(storedCountryRef.current) || 'International') === bizCountry ? storedCountryRef.current : bizCountry,");
    expect(canonicalMarket('ZZ')).toBeNull();
    expect(canonicalMarket(' israel ')).toBe('Local');
  });
  it('LANG-02: Israel / IL end the validity day in Asia/Jerusalem in the client, the server copy and SQL', () => {
    for (const c of ['Local', 'LCL', 'Israel', 'IL', ' israel ']) {
      expect(isQuoteAcceptanceExpired('2026-10-17', c, new Date('2026-10-17T20:59:59Z'))).toBe(false);
      expect(isQuoteAcceptanceExpired('2026-10-17', c, new Date('2026-10-17T21:00:00Z'))).toBe(true);
    }
    expect(isQuoteAcceptanceExpired('2026-10-17', 'ZZ', new Date('2026-10-17T21:00:00Z'))).toBe(false);
    expect(read('../supabase/functions/get-public-quote/validity.ts')).toContain("const timeZone = isLocalValidityCountry(country) ? 'Asia/Jerusalem' : 'Etc/GMT+12'");
    expect(read('../supabase/migrations/20261018000000_quote_expiry_country_alias.sql')).toContain("WHEN btrim(p_country) IN ('Local', 'LCL') OR lower(btrim(p_country)) IN ('israel', 'il') THEN 'Asia/Jerusalem'");
  });
  it('AV-04: the page behind the admin dialog is inert and hidden, except the assistant; restored on close', () => {
    const behind = document.createElement('div'); behind.id = 'behind'; document.body.appendChild(behind);
    const chat = document.createElement('div'); chat.className = 'ai-chat-container'; document.body.appendChild(chat);
    const noop = () => {};
    const { unmount } = render(<AdminProtectedDialog isHebrew kind="reset" target={{ email: 'a@b.test', business_name: 'A' }} reason="" onReason={noop} password="" onPassword={noop} busy={false} error={null} onSubmit={noop} onClose={noop} />);
    expect(behind.inert).toBe(true);
    expect(behind.getAttribute('aria-hidden')).toBe('true');
    expect(chat.inert).not.toBe(true);
    expect(chat.getAttribute('aria-hidden')).toBeNull();
    unmount();
    expect(behind.inert).not.toBe(true);
    expect(behind.getAttribute('aria-hidden')).toBeNull();
    behind.remove(); chat.remove();
  });
});

// L-26: Owner console 2026-10-18, typed: "להחזיר את שלושתם למצב הקודם שאישרתי" (+ "ולנעול, עד אישור מפורש שלי"), "את החייג אליי להשאיר
// איך שהוא עכשיו", "להחזיר את ההצעה החמה לאיפה שהיתה", "את היצוא לאקסל למקם מימין למיון".
describe('L-26 the desktop document card, the hot banner position, the export position', () => {
  // "אני רוצה שהוא יהיה בדיוק כמו הגודל שהוא עכשיו בלייף בהצעה של דוד אלומיניום!!!!! רק לתקן את האיזון של המספרים והבולד של הסה"כ"
  it.each([['HE', 'pages/PublicQuote.jsx'], ['EN', 'pages/PublicQuoteEn.jsx']])('%s: the document keeps the LIVE size and frame (830px card, 18px #dfe8e5 frame, 22px radius)', (_n, f) => {
    const s = read(f);
    expect(s).toContain("<div className=\"pq-column pq-card-desktop-width\" style={{ width: '100%', maxWidth: '830px' }}>");
    expect(s).toContain("style={{ background: 'white', borderRadius: '22px', boxShadow: '0 9px 28px rgba(16,29,35,0.11)', border: '18px solid #dfe8e5', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}");
    expect(s).toContain('max-width: 830px !important;');
  });
  it('IRON-NUMERIC-001: one amount axis (table Amount column = totals amount column, equal decimal boxes) and a dark black bold grand total', () => {
    const hook = read('quoteDocument/useAmountAxis.js');
    expect(hook).toContain("box.style.setProperty('--pq-amount-col', `${width}px`);");
    expect(hook).toContain('export function syncDecimalColumns(card)');
    for (const f of ['pages/PublicQuote.jsx', 'pages/PublicQuoteEn.jsx']) expect(read(f)).toContain('useAmountAxis(cardRef);');
    const css = read('quoteDocument/quoteDocument.css');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) var(--pq-amount-col, 21%) !important;');
    expect(css).toMatch(/\.pq-totals-box \.pq-total-final-amount \{\s*color: #0b0f19 !important;\s*background: transparent !important;\s*box-shadow: none !important;\s*text-shadow: 0\.35px 0 0 currentColor/);
    expect(css).toMatch(/td\.pq-td-total \.pf-money \{\s*font-weight: 400 !important;/);
    // "עכשיו תגדיל ב 20% בערך את הסכום בסה"כ לתשלום" - "מעולה ככה"
    expect(css).toContain('font-size: calc(var(--pq-amount-font, 13.5px) * 1.2) !important;');
  });
  it('the hot banner stays at the top of the quotes screen (not in the dashboard header); the header Call CTA is unchanged', () => {
    expect(read('components/QuotesTab.jsx')).toContain('<div className="quote-hot-banner" data-testid="hot-quote-banner"');
    expect(read('pages/Dashboard.jsx')).not.toContain('dash-header-hot');
    expect(read('components/PublicQuoteHeader.jsx')).toContain('{callCta(useCompactBranch)}');
  });
});

// L-28: Owner console 2026-10-18, typed: "זה חייב להראות בדיוק כמו המסך רק מבלי להדפיס את ההדר בשחור" - Print and the Direct PDF ARE
// the screen document; the header band on paper is white with dark text; the Direct PDF keeps the screen's amount axis.
describe('L-28 Print and the Direct PDF = the screen document', () => {
  const css = read('quoteDocument/quoteDocument.css');
  it('the screen-parity rules govern print and the capture; the separate A4 layer is gone; the paper only drops the frame', () => {
    const parity = css.slice(css.indexOf('/* ---------- screen parity with the Owner-approved landing quotation'), css.indexOf('/* ---------- header band: output modes'));
    expect(parity).toMatch(/@media screen, print \{/);
    expect(css).not.toMatch(/\/\* ---------- A4 layout/);
    expect(css).toMatch(/\n\.pq-pdf-capturing \.pq-card \{\s*border: 0 !important;\s*box-shadow: none !important;\s*border-radius: 0 !important;/);
  });
  it('the header band on paper keeps the screen geometry, WHITE with dark text (never black)', () => {
    expect(css).toMatch(/@media print \{\s*\.pq-letterhead \.pq-lh-band,\s*\.pq-letterhead\.pq-letterhead-modern \.pq-lh-band\.pq-modern-head \{\s*background: #FFFFFF !important;\s*background-image: none !important;\s*color: var\(--pq-ink\) !important;/);
    expect(css).toMatch(/\n\.pq-pdf-capturing \.pq-letterhead \.pq-lh-band,\s*\.pq-pdf-capturing \.pq-letterhead\.pq-letterhead-modern \.pq-lh-band\.pq-modern-head \{\s*background: #FFFFFF !important;/);
  });
  it('the Direct PDF clone: digits in centred tabular boxes inside an LTR-isolated number, then the amount axis re-measured', async () => {
    const pdf = read('utils/generateQuotePdf.js');
    expect(pdf).toContain('tabularizeDigitsForCapture(clonedEl);\n        syncAllAmountAxes(clonedEl);');
    expect(pdf).toContain("el.style.direction = 'ltr';\n    el.style.unicodeBidi = 'isolate';");
    const { tabularizeDigitsForCapture } = await import('./utils/generateQuotePdf');
    const proto = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () { return { width: 8, height: 10, top: 0, left: 0, right: 8, bottom: 10, x: 0, y: 0 }; };
    try {
      const root = document.createElement('div'); root.setAttribute('dir', 'rtl');
      root.innerHTML = '<span class="pq-num-slot">3.40</span><span class="pf-money">₪1,235.00</span>';
      document.body.appendChild(root);
      expect(tabularizeDigitsForCapture(root)).toBe(9); // 3 + 6 digits
      for (const el of root.querySelectorAll('.pq-num-slot, .pf-money')) { expect(el.style.direction).toBe('ltr'); expect(el.style.unicodeBidi).toBe('isolate'); }
      expect(root.querySelector('.pq-num-slot').textContent).toBe('3.40');
      expect(root.querySelector('.pf-money').textContent).toBe('₪1,235.00');
      root.remove();
    } finally { Element.prototype.getBoundingClientRect = proto; }
  });
});
