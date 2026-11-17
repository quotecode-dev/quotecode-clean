// Owner console 17/11 typed (L-14): "מאשר תיקון כותרת תנאי השימוש בעברית בטלפון כמו בפרטיות, כולל שינוי ב-L-14, ושחרור עד הלייב".
// The Hebrew terms title keeps "(Terms of Service)" as one left-to-right piece that never wraps inside itself (on a phone the brackets
// were drawn reversed: "Terms of)" / "(Service"), exactly like the privacy title (12/11); the English title is unchanged.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Terms from './Terms';
import Privacy from './Privacy';

const h1 = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>).container.querySelector('h1');

describe('the Hebrew terms title keeps "(Terms of Service)" whole', () => {
  it('Hebrew: an isolated LTR piece that does not wrap, after "תנאי שימוש"', () => {
    const t = h1(<Terms isHebrew />);
    expect(t.textContent).toBe('תנאי שימוש (Terms of Service)');
    const piece = t.querySelector('bdi');
    expect(piece).not.toBeNull();
    expect(piece.getAttribute('dir')).toBe('ltr');
    expect(piece.textContent).toBe('(Terms of Service)');
    expect(piece.style.whiteSpace).toBe('nowrap');
  });
  it('the title size follows the privacy title (shrinks on a phone)', () => {
    expect(h1(<Terms isHebrew />).style.fontSize).toBe(h1(<Privacy isHebrew />).style.fontSize);
  });
  it('English: the plain title, no isolated piece', () => {
    const t = h1(<Terms isHebrew={false} />);
    expect(t.textContent).toBe('Terms of Service');
    expect(t.querySelector('bdi')).toBeNull();
  });
});
