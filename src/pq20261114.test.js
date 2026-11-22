// 2026-11-14 (Owner approved fixes 1 + 2 after the AI tree eye check): on the customer page the quantity and its unit never split
// ("Quantity: 20.00" / "m²" on two lines at 390), Hebrew and English alike; the English hint says "a floor's" / "a room's" /
// "an apartment's" - the article follows the word (before: always "an").
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { groupWord } from './utils/quoteGroups';

const he = fs.readFileSync('src/pages/PublicQuote.jsx', 'utf8');
const en = fs.readFileSync('src/pages/PublicQuoteEn.jsx', 'utf8');

describe('the customer page quantity line keeps the number and the unit together', () => {
  it('a no-break space between the quantity and the unit, HE and EN', () => {
    expect(he).toContain('{`כמות: ${formatQuantity(activeQty, item.pricing_unit)}\\u00a0${unitLabel}`}');
    expect(en).toContain('{`Qty: ${formatQuantity(activeQty, item.pricing_unit)}\\u00a0${unitLabel}`}'); // 2026-11-14 (Owner): the short word, one line
    expect(he).not.toContain('{`כמות: ${formatQuantity(activeQty, item.pricing_unit)} ${unitLabel}`}');
    expect(en).not.toContain('{`Quantity: ${formatQuantity(activeQty, item.pricing_unit)} ${unitLabel}`}');
  });
});

describe('the English hint: "a" or "an" by the word', () => {
  it('the hint carries @A, and the article rule gives a floor / a room / an apartment', () => {
    expect(en).toContain("Tap the arrow next to @A @S's name");
    expect(en).not.toContain("next to an @S's name");
    expect(en).toContain(".replace('@A', /^[aeiou]/i.test(groupWord(((quoteSections || []).find((sec) => sec.kind) || {}).kind, false)) ? 'an' : 'a')");
    const article = (kind) => (/^[aeiou]/i.test(groupWord(kind, false)) ? 'an' : 'a');
    expect(article('floor')).toBe('a');
    expect(article('room')).toBe('a');
    expect(article('apartment')).toBe('an');
  });
});

// 2026-11-14 (Owner: "כשהשורה מכווצת המשולש צריך להיות לכיוון השורה/הנושא וכשפותחים השפיץ של המשולש צריך להיות כלפי מטה"; confirmed
// "כן" on the example): closed = toward the name (Hebrew ◀ - the triangle is to the right of the name; English ▶ - to its left), open = ▼
describe('the customer page triangles: closed points to the heading, open points down', () => {
  it('Hebrew: ◀ closed, ▼ open; English: ▶ closed, ▼ open; never ▲', () => {
    expect(he).toContain(`<span className="pq-chev pq-chev-sub">{isOpen ? '▼' : '◀'}</span>) : (noTriangle ? '' : (isOpen ? '▼' : '◀'))`);
    expect(en).toContain(`<span className="pq-chev pq-chev-sub">{isOpen ? '▼' : '▶'}</span>) : (noTriangle ? '' : (isOpen ? '▼' : '▶'))`);
    expect(he).not.toMatch(/isOpen \? '▲'/);
    expect(en).not.toMatch(/isOpen \? '▲'/);
  });
});

// 2026-11-14 (Owner: "אם זה יהיה בשורה אחת במקום 2 אז כן, מאשר"): the AI window's two buttons keep ONE row on a phone, both languages
describe('the AI smart quote window: the two buttons in one row on a phone', () => {
  it('the button row carries pf-aiq-actions and the phone rule trims the inner space without wrapping the words', () => {
    const dialog = fs.readFileSync('src/components/AiQuoteDraftDialog.jsx', 'utf8');
    const css = fs.readFileSync('src/index.css', 'utf8');
    expect(dialog).toContain(`<div className="pf-aiq-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-end' }}>`);
    expect(css).toMatch(/@media \(max-width: 480px\) \{\s*\.pf-aiq-actions \{ gap: 6px !important; \}\s*\.pf-aiq-actions > button \{ padding-inline: 10px !important; white-space: nowrap; \}\s*\}/);
  });
});

// 2026-11-14 (eye check of the print view): the print rule hides the top-level triangle by making the first letter transparent - only on
// a heading button that still carries a triangle; the print button removes the triangle (noTriangle), and the name's own first letter stays
describe('print: the heading name keeps its first letter', () => {
  it('the transparent first letter applies only to a button with a triangle (not .pq-no-chev), HE and EN', () => {
    for (const src of [he, en]) {
      expect(src).toContain('.pq-section-toggle:not(.pq-no-chev)::first-letter { color: transparent; }');
      expect(src).not.toContain('.pq-section-toggle::first-letter');
      expect(src.split("className={noTriangle ? 'pq-section-toggle pq-no-chev' : 'pq-section-toggle'}").length - 1).toBe(2);
      expect(src).not.toContain('className="pq-section-toggle"');
    }
  });
});

// 2026-11-14 (Owner "א"): a narrow window header shows the short help label (the edit-client X was pushed to the window edge)
describe('the window header picks the help label by its own width', () => {
  it('container query on .pf-modal-head: under 480px the short label, both languages', () => {
    const css = fs.readFileSync('src/index.css', 'utf8');
    expect(css).toContain('.pf-modal-head { container-type: inline-size; container-name: pf-modal-head; }');
    expect(css).toMatch(/@container pf-modal-head \(max-width: 480px\) \{\s*\.pf-ai-help-btn--header \.pf-ai-label-long \{ display: none; \}\s*\.pf-ai-help-btn--header \.pf-ai-label-short \{ display: inline; \}\s*\}/);
  });
});

// 2026-11-14 Owner-typed: "מאשר שינוי ב-L-25: בטלפון שורת הכפתורים בחלון הניהול המוגן בסוף החלון ולא צמודה"
describe('L-25 change: the protected admin dialog action row on a phone', () => {
  it('sticky on desktop / tablet as locked; static (at the end of the dialog) under 600px', () => {
    const css = fs.readFileSync('src/components/adminV2.css', 'utf8');
    expect(css).toContain('.av-dialog-foot { display: flex; gap: 10px; justify-content: flex-end; margin-block-start: 24px; flex-wrap: wrap; position: sticky; inset-block-end: 0;');
    const phone = css.slice(css.indexOf('@media (max-width: 599px) {'));
    expect(phone).toMatch(/\.av-dialog-foot button\[type="submit"\] \{ flex: 1; \}\s*\/\*[^*]*\*\/\s*\.av-dialog-foot \{ position: static; \}/);
  });
});

// 2026-11-14 (eye check): the structure help opens above its button on a wide screen (never over the row of buttons below it)
describe('the structure help bubble position', () => {
  it('above the button from 768px, in the flow on a phone', () => {
    const css = fs.readFileSync('src/components/quoteTree/quoteTree.css', 'utf8');
    expect(css).toContain('@media (min-width: 768.02px) { .qt-structure .qt-pop { top: auto; bottom: calc(100% + 6px); } }');
    expect(css).toContain('.qt-structure .qt-pop { position: static;');
  });
});
