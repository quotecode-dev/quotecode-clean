import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import BrandName from './BrandName';

// TEKANGO Rebrand - BiDi + Inline Brand Highlight Correction (v3): guards the
// two things a plain "TEKANGO" string embedded in HE/RTL prose cannot give on
// its own - semantic LTR isolation (a real <bdi dir="ltr">, not just a
// coincidentally-LTR string) and a stable, always-on brand accent that is
// never the green reserved for success/status semantics.
describe('BrandName', () => {
  it('renders the exact literal brand text, never a transliteration', () => {
    const { container } = render(<BrandName />);
    expect(container.textContent).toBe('TEKANGO');
  });

  it('isolates the brand token with a real <bdi dir="ltr"> for correct BiDi behavior in RTL prose', () => {
    const { container } = render(<BrandName />);
    const bdi = container.querySelector('bdi');
    expect(bdi).not.toBeNull();
    expect(bdi.getAttribute('dir')).toBe('ltr');
    expect(bdi.textContent).toBe('TEKANGO');
  });

  it('defaults to the light-violet accent for dark hosts, never the green success color', () => {
    const { container } = render(<BrandName />);
    const bdi = container.querySelector('bdi');
    expect(bdi.style.color).toBe('rgb(167, 139, 250)');
    expect(bdi.style.color).not.toBe('#34d399');
    expect(bdi.style.fontWeight).toBe('700');
  });

  it('switches to the darker violet accent for light hosts when onDark is false', () => {
    const { container } = render(<BrandName onDark={false} />);
    const bdi = container.querySelector('bdi');
    expect(bdi.style.color).toBe('rgb(109, 40, 217)');
  });
});
