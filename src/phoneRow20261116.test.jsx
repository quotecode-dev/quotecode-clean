// Owner console 2026-11-16 (typed release line "מאשר שחרור משותף על 219 ... שורת פריט בטלפון בעורך (מוצר, כמות ומחיר בשורה אחת, הסכום
// מתחת בצד שמאל ובאנגלית בצד ימין, כפתור הפעולות באותה שורה בצד השני)" + "שם ארוך לא יורד שורה אלא לפי הכלל הוך לסלייד").
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import SlideText from './components/SlideText';

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
  it('a long name stays on one line and slides (no wrap) - and wraps when motion is reduced', () => {
    expect(phone).toContain('.qt-rows tr.qt-row .qt-row-name-box { overflow: hidden; white-space: nowrap; }');
    expect(phone).toContain('@media (max-width: 480px) and (prefers-reduced-motion: reduce)');
    expect(tree).toContain('<SlideText as="span" className="qt-row-name-box" title={it.description}>{it.description}</SlideText>');
    expect(tree).toContain('<tr key={i} className="qt-row" data-testid="qt-row">');
  });
  it('wider screens keep their layout: the phone rules sit only under 480px, the name box does not slide there', () => {
    expect(phone).toContain('.qt-row-name-box > .pf-slide { white-space: normal; display: inline; }');
    const outside = phone.slice(0, phone.indexOf('@media (max-width: 480px)'));
    expect(outside).not.toMatch(/grid-template-areas/);
  });
  it('SlideText can render a span box (inside a button) and keeps the div default', () => {
    const { container, rerender } = render(<SlideText as="span" className="b">x</SlideText>);
    expect(container.firstChild.tagName).toBe('SPAN');
    rerender(<SlideText className="b">x</SlideText>);
    expect(container.firstChild.tagName).toBe('DIV');
  });
});
