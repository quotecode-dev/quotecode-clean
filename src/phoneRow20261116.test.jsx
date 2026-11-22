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

// Owner console 2026-11-20/21 (the simple-quotes sketch is the approved demo; typed L-07 / L-09 / L-19 / L-23 / L-26 / L-29 ... only as needed): the row of the sketch - on a phone the name and "qty unit × price" under it, the sum on the amount axis and "⋯" beside it
describe('the phone quote row (the sketch, 20/11)', () => {
  const phone = css.slice(css.indexOf('@media (max-width: 768px) {'));
  it('the name with its numbers under it; the sum on the axis; the actions in the last column', () => {
    expect(phone).toContain('.qt-ir { grid-template-columns: minmax(0, 1fr) var(--qt-sumw) 36px !important; padding: 6px 10px; }');
    expect(phone).toContain('.qt-ir .qt-ir-sub { display: block; font-size: 12px; color: var(--qt-muted); }');
    expect(phone).toContain('.qt-ir .qt-ir-q, .qt-ir .qt-ir-p, .qt-ir .qt-ir-u { display: none; }');
  });
  it('a long name stays on one line and ends with "…" (the shared one-line rule, the whole name in the bubble); no slide', () => {
    expect(css).not.toContain('pf-slide');
    expect(tree).toContain('<EllipsisText className="qt-row-name-box" text={details ? `${it.description} · ${details}` : it.description} />');
    expect(tree).toContain('data-testid="qt-row">');
  });
  it('a tablet held upright shows the computer table again (601-768px)', () => {
    const tablet = css.slice(css.indexOf('@media (min-width: 601px) and (max-width: 768px) {'));
    expect(tablet).toContain('.qt-ir { grid-template-columns: var(--qt-cols) !important; padding: 0 10px; min-height: 38px; }');
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
