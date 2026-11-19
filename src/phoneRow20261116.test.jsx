// Owner console 2026-11-16 (typed release line "מאשר שחרור משותף על 219 ... שורת פריט בטלפון בעורך (מוצר, כמות ומחיר בשורה אחת, הסכום
// מתחת בצד שמאל ובאנגלית בצד ימין, כפתור הפעולות באותה שורה בצד השני)" + "שם ארוך לא יורד שורה אלא לפי הכלל הוך לסלייד").
// The slide part replaced by the Owner (console 2026-11-19, typed: "מאשר שלוש נקודות עם ריחוף במחשב ובועה בנגיעה בנייד בכל המקומות כמו בתמונות,
// ... ושחרור עד הלייב"): a long name on a phone stays on one line and ends with "…"; a tap shows it whole (EllipsisText).
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EllipsisText from './components/EllipsisText';

const here = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(here, 'components/quoteTree/quoteTree.css'), 'utf8').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));
const tree = fs.readFileSync(path.join(here, 'components/quoteTree/QuoteTreeEditor.jsx'), 'utf8');

describe('the phone quote row (Owner 2026-11-16)', () => {
  const phone = css.slice(css.indexOf('/* Owner console 2026-11-16'));
  it('item, quantity and price on one line; the total under them at the end side, the actions at the start side', () => {
    expect(phone).toContain('@media (max-width: 480px)');
    expect(phone).toContain('grid-template-areas: "desc qty price" "act sum sum"');
    expect(phone).toMatch(/td\.qt-sum \{ grid-area: sum;[^}]*justify-self: end;/);
    expect(phone).toMatch(/td\.qt-act \{ grid-area: act;[^}]*justify-self: start;/);
    // its menu opens from the start side into the screen
    expect(phone).toContain('.qt-rows tr.qt-row > td.qt-act .qt-menu { inset-inline-end: auto; inset-inline-start: 0; }');
  });
  it('a long name stays on one line and ends with "…" on a phone (no slide, no wrap)', () => {
    expect(phone).toContain('.qt-rows tr.qt-row .qt-row-name-box { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; min-width: 0; }');
    expect(phone).not.toContain('pf-slide');
    expect(tree).toContain('<EllipsisText plain className="qt-row-name-box" text={it.description} />');
    expect(tree).toContain('<tr key={i} className="qt-row" data-testid="qt-row">');
  });
  it('wider screens keep their layout: the phone rules sit only under 480px, the name wraps there as before', () => {
    expect(phone).toContain('.qt-row-name-box { display: block; }');
    const outside = phone.slice(0, phone.indexOf('@media (max-width: 480px)'));
    expect(outside).not.toMatch(/grid-template-areas/);
    expect(outside).not.toMatch(/text-overflow: ellipsis/);
  });
  it('EllipsisText renders a span box by default (inside a button) and a div when asked; `plain` leaves the one-line rule to the caller', () => {
    const { container, rerender } = render(<EllipsisText className="b" text="x" />);
    expect(container.firstChild.tagName).toBe('SPAN');
    expect(container.firstChild.className).toBe('pf-ell b');
    rerender(<EllipsisText as="div" className="b" text="x" />);
    expect(container.firstChild.tagName).toBe('DIV');
    rerender(<EllipsisText plain className="b" text="x" />);
    expect(container.firstChild.className).toBe('b');
  });
});
