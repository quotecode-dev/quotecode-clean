import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { useRef } from 'react';
import { useMoneySlotSize } from './useMoneySlotSize';

function Host({ texts, enabled = true }) {
  const ref = useRef(null);
  useMoneySlotSize(ref, texts, { enabled });
  return <div data-testid="host" ref={ref} />;
}

afterEach(() => vi.restoreAllMocks());

describe('useMoneySlotSize (IRON-MOBILE-WIDTH-001 x IRON-NUMERIC-001)', () => {
  it('sets --pf-money-slot-size to the WIDEST rendered amount (+1px), not a worst-case constant', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function measure() {
      return { width: (this.textContent || '').length * 7.5, height: 10, top: 0, left: 0, right: 0, bottom: 0 };
    });
    const { getByTestId } = render(<Host texts={['₪100.00', '₪28,346.00', '₪9.00']} />);
    // widest = 10 chars * 7.5 = 75 -> ceil + 1
    expect(getByTestId('host').style.getPropertyValue('--pf-money-slot-size')).toBe('76px');
    expect(getByTestId('host').querySelector('span')).toBeNull(); // the probe is removed
  });

  it('does nothing when disabled (desktop) and clears the property when nothing measurable is rendered', () => {
    const { getByTestId, rerender } = render(<Host texts={['$1.00']} enabled={false} />);
    expect(getByTestId('host').style.getPropertyValue('--pf-money-slot-size')).toBe('');
    rerender(<Host texts={[]} />);
    expect(getByTestId('host').style.getPropertyValue('--pf-money-slot-size')).toBe('');
  });
});
