// Owner console 2026-11-10 (the combined release 1-19, typed: "מאשר להתחיל את השחרור המשותף 1-19"): guards of the editor and app items.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { readFileSync } from 'node:fs';
import QuoteRowsEditor from './components/QuoteRowsEditor';

afterEach(cleanup);
const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
function H({ initial, isHebrew = true }) {
  const [items, setItems] = useState(initial);
  return <QuoteRowsEditor items={items} setItems={setItems} services={[]} isHebrew={isHebrew} sym="₪" fmtMoney={(v) => Number(v).toFixed(2)} />;
}

describe.each([
  [true, 'בדקו את השורות לפני השמירה', 'חסר מחיר', 'בחרו יחידת חיוב', 'פעולות לשורה'],
  [false, 'Review the rows before saving', 'Missing price', 'Choose a billing unit', 'Row actions'],
])('isHebrew=%s', (he, note, missing, unit, menu) => {
  it('G8: rows from the smart quote / a file - the review note, "missing price" by an empty price, "choose a billing unit"', () => {
    render(<H isHebrew={he} initial={[{ id: 'a', description: 'ריצוף', quantity: '24', unit_price: '', _review: true, _noUnit: true }, { id: 'b', description: 'צבע', quantity: '1', unit_price: '100' }]} />);
    expect(screen.getByTestId('qrow-review-note').textContent).toBe(note);
    expect(screen.getByTestId('qrow-missingprice-a').textContent).toBe(missing);
    expect(screen.getByTestId('qrow-chooseunit-a').textContent).toBe(unit);
    expect(screen.queryByTestId('qrow-missingprice-b')).toBe(null);
  });
  it('no review note for ordinary rows; G6b: the row menu button says what it is', () => {
    render(<H isHebrew={he} initial={[{ id: 'c', description: 'x', quantity: '1', unit_price: '5' }]} />);
    expect(screen.queryByTestId('qrow-review-note')).toBe(null);
    expect(screen.getByTestId('qrow-menu-label-c').textContent).toBe(menu);
    expect(screen.getByTestId('qrow-menu-c').getAttribute('aria-label')).toBe(menu);
  });
});

describe('app items', () => {
  const dash = src('./pages/Dashboard.jsx');
  it('G8: the smart quote and the file mark their rows for review', () => {
    expect(dash.split('markForReview(draftLinesToQuoteItems(lines), lines)').length - 1).toBe(2);
  });
  it('G6b option "ב": on the phone the row menu stays the three dots (desktop and tablet show its text); the chat knows both', () => {
    const css = src('./index.css');
    expect(css).toMatch(/\.qrows \.qrow-line \{ grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\) 44px;/);
    expect(css).toContain('.qrows .qrow-line .qrow-menu-label { display: none; }');
    expect(css).toMatch(/grid-template-columns: minmax\(min\(140px, 20%\), 2fr\) minmax\(112px, 1fr\)/);
    const howTo = src('./data/productHowTo.js');
    expect(howTo).toContain('בכפתור "פעולות לשורה" של השורה (בטלפון: שלוש הנקודות של השורה)');
    expect(howTo).toContain('in the "Row actions" button of the row (on a phone: the three dots of the row)');
    // 2026-11-12 (unified quote): the button is named by the chosen word (apartment / room / floor) - the chat says where it is
    expect(howTo.split('כפתור הפעולות').length - 1).toBeGreaterThanOrEqual(2);
    expect(howTo.split('actions button in the header').length - 1).toBeGreaterThanOrEqual(2);
  });
  it('the 13 items (Owner console 2026-11-10, L-02 / L-09 / L-24 / L-27 / L-28): Hebrew and English show the same, clear things', () => {
    const doc = src('./quoteDocument/quoteDocument.css');
    expect(doc).toContain(".pq-page[dir='rtl'] .pq-card .pq-totals-box { row-gap: 10px; }"); // 1
    expect(src('./quoteDocument/useAmountAxis.js')).toContain('syncDecimalColumns(card); syncQtyCentre(card);'); // 2
    expect(doc).not.toMatch(/td.pq-td-qty .pq-unit-slot { display: block !important/); // item 3 + L-28: on paper the unit stays beside its number
    expect(src('./index.css')).toContain(".qrows[dir='rtl'] .qrow-total.qrow-total-empty { text-align: left !important; }");
    expect(src('./components/QuoteForm.jsx')).toContain("<Plus size={14} strokeWidth={3} aria-hidden=\"true\" style={{ display: 'inline-block', verticalAlign: '-2px', marginInlineEnd: '6px' }} />");
    expect(src('./pages/PublicQuoteEn.jsx')).toContain('✓ This quote has been approved and signed.</div>'); // 3
    expect(src('./pages/PublicQuote.jsx')).toContain('✓ הצעת המחיר אושרה ונחתמה.</div>');
    expect(src('./components/PublicQuoteHeader.jsx')).toContain("valid: 'Valid until',"); // 4
    expect(doc).toMatch(/\.pq-total-final-label \{ font-size: calc\(var\(--pq-amount-font, 12px\) \* 1\.2\) !important; \}/); // 6
    const rows = src('./components/QuoteRowsEditor.jsx'); // 7
    expect(rows).toContain("minWidth: 'var(--qrow-total-w, 72px)', boxSizing: 'border-box', justifySelf: 'end', textAlign: 'right'");
    expect(rows).toContain("root.style.setProperty('--qrow-total-w', ");
    expect(rows).toContain("<span style={{ justifySelf: 'end', minWidth: 'var(--qrow-total-w, 72px)', textAlign: 'right', whiteSpace: 'nowrap' }}>{t.total}</span><span style={{ visibility: 'hidden'");
    expect(doc).toContain(".pq-page[dir='rtl'] .pq-card .pq-total-rule { margin-top: 0; padding-top: 2px; }");
    expect(src('./quoteDocument/useAmountAxis.js')).toContain("th.style.setProperty('padding-left', ");
    expect(src('./components/landing/landing.css')).toContain('.tl-tools-copy > .tl-capability-icon { flex-shrink: 0; }');
    const qf = src('./components/QuoteForm.jsx');
    expect(qf).toContain(`data-testid="unit-add-row" style={{ flex: '1 1 140px',`); // 8
    expect(qf.split("fontSize: isHebrew ? '0.9rem' : '0.75rem', fontWeight: '800'").length - 1).toBe(2); // 9
    expect(qf).toContain('<form id="pf-editor-form" className="pf-screen-body pf-editor-form"'); // 10
    expect(src('./index.css')).toContain('.pf-editor-form { padding-bottom: 64px; }');
    const land = src('./components/landing/landing.css'); // 11
    expect(land).toContain('@media (min-width: 768px) { .tl-tools { flex-wrap: nowrap; } .tl-tools > .tl-ghost { flex-shrink: 0; } }');
    expect(land).toContain('@media (max-width: 480px) { .tl-tools > .tl-ghost { font-size: 14px; padding-left: 12px; padding-right: 12px; } }');
    expect(src('./pages/LandingLocal.jsx')).toContain("text: 'הצעת מחיר מקצועית וברורה, שלב אחר שלב.',"); // 12
    expect(src('./pages/LandingGlobal.jsx')).toContain("text: 'A professional quote, one clear step at a time.',");
  });
  it('G9: a quote whose link went out says the customer link was updated', () => {
    expect(dash).toContain('השינויים נשמרו והקישור של הלקוח עודכן.');
    expect(dash).toContain("Changes saved. The client's link now shows the update.");
  });
  it('wording 2: the attach button names the customer and keeps the size limit', () => {
    // 2026-11-12 (law 49): the same words; "3 MB" kept as one left-to-right piece in Hebrew
    expect(src('./components/QuoteForm.jsx')).toContain("{isHebrew ? <span>צירוף קובץ ללקוח (עד <bdi dir=\"ltr\">3 MB</bdi>)</span> : 'Attach file for client (max 3 MB)'}");
  });
  it('G6a / G6b: identical units show the sums by name; the unit menu button says what it is', () => {
    const qf = src('./components/QuoteForm.jsx');
    // 2026-11-12 (unified quote): the same names, in the chosen word (apartment / room / floor / section)
    expect(qf).toContain('סכום ל{W}:');
    expect(qf).toContain('Per {w}:');
    expect(qf).toContain("{isHebrew ? `פעולות ל${W}` : `${W} actions`}</span>");
  });
  it('finding 3: the editor locks the appearance only with the quote; the open customer page notices an appearance change', () => {
    expect(src('./components/quotePresentation/useQuotePresentationEditor.js')).toContain('const readOnly = !!server.locked;');
    expect(src('./components/SmartPublicQuote.jsx')).toMatch(/p\.fingerprint !== presentationRef\.current\.fingerprint/);
  });
  it('the customer document: Hebrew amounts against the outer edge with ONE money box; 16px table; no unit wrap; red discount; padded signed box', () => {
    const css = src('./quoteDocument/quoteDocument.css');
    expect(css).toMatch(/\.pq-page\[dir='rtl'\] \.pq-card \.pq-commercial-table td\.pq-td-total \{ text-align: left !important; \}/);
    expect(css).toMatch(/min-width: calc\(var\(--pq-money-box-n, 0\) \* 1em\) !important;/);
    expect(css).toMatch(/@media \(min-width: 641px\), print \{\s*\.pq-page\[dir='rtl'\] \.pq-card \.pq-commercial-table,/);
    expect(css).toContain('.pq-page .pq-card .pq-commercial-table td.pq-td-qty { white-space: nowrap; }');
    expect(css).toContain('.pq-page .pq-card .pq-total-value.pq-discount-negative { color: #dc2626; }');
    expect(css).toContain('.pq-page .pq-card .pq-approval.pq-approval-signed { padding: 16px 20px; }');
    expect(src('./quoteDocument/useAmountAxis.js')).toContain('export function syncMoneyBox(card)');
    expect(src('./pages/PublicQuote.jsx')).toContain('הצעת מחיר כללית בסך <span className="pf-money">{currencySymbol}{formatWholeMoney(finalTotalRounded)}</span>');
  });
  it('landing: Excel in the English FAQ; the Hebrew tools card names the free companion (the tablet page-end clearance already exists: 148px)', () => {
    expect(src('./components/landing/landing.css')).toMatch(/@media \(max-width: 1180px\) \{\s*\.tl-footer \{ padding-bottom: 148px; \}/);
    expect(src('./pages/LandingGlobal.jsx')).toContain("q: 'Can I export my quotes and financial reports to Excel?'");
    expect(src('./pages/LandingLocal.jsx')).toContain('כשירות חינמי נלווה ל-<BrandName onDark={false} />');
  });
});
