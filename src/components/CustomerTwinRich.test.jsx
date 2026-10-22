// Night task 2026-10-23 (CT-07 follow-up, IRON-NUMERIC-001): in the Customer Twin texts a currency sign and a percent stay inside the
// isolated LTR run, a date / time / phone / range is ONE run, and a d/m/y date is read in the market's order.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Rich } from './CustomerTwinPanel';

afterEach(() => cleanup());
const runs = (text, market = 'IL') => [...render(<Rich text={text} market={market} />).container.querySelectorAll('bdi')].map((b) => b.textContent);

describe('Customer Twin text runs', () => {
  it('the shekel sign and the percent stay inside the number run (whole shekels with .00)', () => {
    expect(runs('המחיר ₪1,200 עם הנחה של 30%')).toEqual(['₪1,200.00', '30%']);
    expect(runs('סך הכול 1,199.6₪')).toEqual(['₪1,200.00']);
    expect(runs('Total $35.5', 'INTERNATIONAL')).toEqual(['$35.50']);
  });
  it('a date, a time, a phone number and a range are each one run', () => {
    expect(runs('בתוקף עד 2026-11-30 בשעה 10:30, טלפון 050-1234567, 10-20 ימי עבודה')).toEqual(['30/11/2026', '10:30', '050-1234567', '10-20']);
  });
  it('a d/m/y date follows the market; a date that does not exist is shown as written', () => {
    expect(runs('עד 03/04/2026')).toEqual(['03/04/2026']);
    expect(runs('until 11/30/2026', 'INTERNATIONAL')).toEqual(['11/30/2026']);
    expect(runs('until 31/02/2026', 'INTERNATIONAL')).toEqual(['31/02/2026']);
  });
  it('plain text stays plain (no HTML)', () => {
    const { container } = render(<Rich text={'<b>x</b> 5'} market="IL" />);
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toBe('<b>x</b> 5');
  });
});
