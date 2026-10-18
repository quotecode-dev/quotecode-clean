import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '@testing-library/react';
import AdminProtectedDialog from './components/AdminProtectedDialog';
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
  // #2 superseded by the Owner's own decision (2026-10-18, L-29): the list is in pages - desktop as many as fit, phone 20 a page
  it('#2 -> L-29: the quote list in pages (desktop as many as fit, phone / tablet 20), previous / next, in the sorted order', () => {
    expect(tab).toContain('const pageRows = rowsMeta.slice(currentPage * perPage, (currentPage + 1) * perPage);');
    expect(tab).toContain('const MOBILE_QUOTES_PER_PAGE = 20;');
    expect(tab).toContain("useEffect(() => { setListPage(0); }, [searchTerm, statusFilter, quoteSortField, quoteSortDirection]);");
    expect(tab).not.toContain('pickCompactRows');
    const goTo = tab.slice(tab.indexOf('  const goToPage = (p) => {'), tab.indexOf('  // a new search / filter / sort starts on the first page'));
    expect(goTo).not.toContain('scrollIntoView'); // "המסך קופץ": a page change never moves the screen
    expect(tab).toMatch(/\{isHebrew \? 'הדף הקודם' : 'Previous page'\}/);
    expect(tab).toMatch(/\{isHebrew \? 'הדף הבא' : 'Next page'\}/);
  });
  it('#3 with no hot quote the banner says so (the Owner copy of 2026-09-08)', () => {
    // the Owner kept it ("להשאיר את הפס"); it steps aside while a search is typed with the orange banner ("שאלה 2: ב")
    expect(tab).toContain("{!hotLead && !quotesNotLoaded && !searchActive && (");
    expect(tab).toContain("'אין כרגע הצעה חמה'");
    expect(tab).toContain("'כשהצעה תיצפה 3 פעמים או יותר ועדיין לא תאושר, היא תופיע כאן.'");
  });
  // Owner console 2026-10-18, one item at a time: "שאלה 1: א" (the eye opens the quote in the list with its tracking details),
  // "שאלה 2: ב" (the banner steps aside while a search is typed)
  it('#4 the hot banner reads every quote; its eye opens the quote in the list; it steps aside while a search is typed', () => {
    expect(tab).toContain('const hotSource = (Array.isArray(allQuotes) && allQuotes.length ? allQuotes : quotes) || [];');
    expect(tab).toContain("const searchActive = !!String(searchTerm || '').trim();");
    expect(tab).toContain('{hotLead && !searchActive && (');
    expect(tab).toContain('{!hotLead && !quotesNotLoaded && !searchActive && (');
    expect(tab).toContain('openTrackingFor(quoteId);');
    expect(tab).toContain("if (q && typeof window !== 'undefined') window.open(getQuoteViewLink(q), '_blank');");
  });
  it('#5 the phone filter sheet uses the same shown-status options as the desktop', () => {
    expect(tab).toContain('{QUOTE_FILTER_OPTIONS.map((f) => <option key={f} value={f}>{quoteFilterLabel(f, isHebrew)}</option>)}');
  });
  it('#8 the save / error toast is centred over the workspace (half of the 178px sidebar)', () => {
    expect(dash).toContain("left: calc(50% ${isHebrew ? '- 89px' : '+ 89px'});");
  });
  it('#13 the measured-quote hint promises no rooms', () => {
    // the Owner's own choice (2026-10-18, "א"): the plainest wording
    expect(read('utils/newQuoteChoices.js')).toContain("hint: isHebrew ? 'מכניסים מידות, והמחיר מחושב לבד' : 'Enter the measurements - the price is calculated for you',");
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
  // #22 בעל המערכת 2026-10-18: "לגבי המחשב תשתמש בנמוך יותר" (מחשב 62), בטלפון "שניהם נראים אותו דבר" (נשאר 78)
  it.each(pages)('%s #20 phone: full width, no paper frame; #22 tiles 62px on desktop (phone 78px); #24 one notice for an unfinished draft; #25 live business details', (_n, s) => {
    expect(s).toMatch(/\.pq-card \{\{?\s*padding: 2px !important;\s*background: transparent !important;\s*box-shadow: none !important;\s*border: none !important;\s*border-radius: 0 !important;/);
    expect(s).toMatch(/min-height: 62px;\s*padding: 9px 6px;\s*border-radius: 10px;/);
    expect(s).not.toContain('min-height: 92px;');
    expect(s).toMatch(/\.pq-action-tile \{\s*min-height: 78px !important;\s*padding: 10px 4px !important;/);
    expect(s).toContain('} else if (isExpired && !isUnfinishedDraft) {');
    expect(s).toContain('const brand = { ...(issuedBranding || {}), ...liveBusiness };');
  });
  // בעל המערכת 2026-10-18: "למה בנייד החייג אליי למטה? ולא למעלה בצד שמאל כמו במחשב?" -> "החייג אליי בסדר"
  it('the modern style on a phone: "חייג/י אליי" in the top outer corner beside the business name, the details below', () => {
    const css = read('quoteDocument/quoteDocument.css');
    expect(css).toContain('.pq-letterhead.pq-letterhead-modern .pq-modern-aside { display: contents; }');
    expect(css).toContain('.pq-letterhead.pq-letterhead-modern .pq-modern-aside > .pq-lh-call { grid-column: 2; grid-row: 1; margin-bottom: 0; align-self: start; }');
    expect(css).toContain('.pq-letterhead.pq-letterhead-modern .pq-modern-aside > :not(.pq-lh-call) { grid-column: 1 / -1; }');
    // "בנייד: את כל פרטי העסק להוריד 2 פיקסלים למטה ו2 פיקסלים שמאלה / את החייג אליי אותו דבר, זה צמוד מידי לקצוות"
    expect(css).toContain('.pq-page .pq-card .pq-letterhead .pq-lh-band .pq-lh-issuer { position: relative; inset-block-start: 2px; inset-inline-start: 2px; }');
    expect(css).toContain('.pq-page .pq-card .pq-letterhead .pq-lh-band .pq-lh-call { position: relative; inset-block-start: 2px; inset-inline-end: 2px; }');
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

// #10: Owner console 2026-10-18, typed: "תחזיר רק מועל ע"י", "להשאיר את הרקע הכהה, לכתוב מופעל על ידי בלבן והלוגו הקטן על רקע לבן", the
// wording "מבית TEKANGO" (accepted: "לא שלם עם זה ב100% אבל תנעל, בוא נתקדם"); Sign out stays in the gear menu
describe('#10 the sidebar platform line', () => {
  const dash = read('pages/Dashboard.jsx');
  it('one line under the business identity: "מבית TEKANGO" in white + the small TEKANGO symbol on a white square', () => {
    expect(dash).toContain(`<span className="dash-sidebar-platform-brand-label">{isHebrew ? 'מבית ' : 'by '}<bdi dir="ltr">TEKANGO</bdi></span>`);
    expect(dash).toContain('<span className="dash-sidebar-platform-brand-logo"><ProFlowLogo size={13} /></span>');
    expect(dash).toContain('.dash-sidebar-platform-brand .dash-sidebar-platform-brand-label { color: #ffffff; }');
    expect(dash).toContain('.dash-sidebar-platform-brand-logo { display: inline-flex; padding: 2px; background: #ffffff; border-radius: 0; line-height: 0; }');
    expect(dash).toContain('onSignOut={() => setShowSignOutModal(true)}');
  });
});

// #15: Owner console 2026-10-18, typed: "אני חושב שפיננסים הכי מתאים כשם כולל", "שהסמל יהיה כמו הכותרת בסיידבר" - one name, and every
// screen title carries its own sidebar icon
describe('#15 one name and one icon per screen', () => {
  it('"פיננסים" / "Finances" everywhere', () => {
    expect(read('pages/Dashboard.jsx')).toContain("financesNav: isHebrew ? 'פיננסים' : 'Finances',");
  });
  it.each([
    ['components/FinancesTab.jsx', '<ChartSquareIcon size={18}', 'ChartSquareIcon'],
    ['components/ClientsTab.jsx', '<User size={18}', 'User'],
    ['components/ServicesCatalog.jsx', '<LayoutGrid size={18}', 'LayoutGrid'],
    ['components/StatisticsTab.jsx', '<BarChart3 size={18}', 'BarChart3'],
    ['components/TasksTab.jsx', '<ListChecks size={18}', 'ListChecks'],
    ['components/CalendarTab.jsx', '<CalendarDays size={18}', 'CalendarDays'],
  ])('%s: the title icon is the sidebar icon (%s)', (file, title, navIcon) => {
    const src = read(file);
    const h2 = src.slice(src.indexOf('<h2'), src.indexOf('</h2>', src.indexOf('<h2')));
    expect(h2).toContain(title);
    expect(read('utils/dashboardNavCapabilities.js')).toMatch(new RegExp(`icon: ${navIcon},`));
  });
});
