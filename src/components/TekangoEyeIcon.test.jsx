import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import TekangoEyeIcon from './TekangoEyeIcon';

// Owner update 2026-10-09: the hot-quote eye is an ORIGINAL illustrated SVG (no Lucide/generic/pixel icon) in TEKANGO colours,
// legible at 24px, and only its eyelid animates.
describe('TekangoEyeIcon', () => {
  it('is an original decorative 24px SVG on a 24-unit grid (not a Lucide icon)', () => {
    const { container } = render(<TekangoEyeIcon className="x" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('data-icon', 'tekango-eye');
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg.getAttribute('class')).toBe('tk-eye x');
    expect(svg.getAttribute('class')).not.toMatch(/lucide/);
  });

  it('draws the illustrated parts: clipped eye opening, teal gradient iris with pupil and catch-light, liner and lashes', () => {
    const { container } = render(<TekangoEyeIcon />);
    const svg = container.querySelector('svg');
    const clipId = svg.querySelector('clipPath').id;
    const opening = svg.querySelector(`g[clip-path="url(#${clipId})"]`);
    expect(opening).not.toBeNull();
    const stops = [...svg.querySelectorAll('radialGradient stop')].map((s) => s.getAttribute('stop-color'));
    expect(stops).toContain('#0F6672'); // TEKANGO teal
    expect(opening.querySelectorAll('circle').length).toBeGreaterThanOrEqual(3); // iris, pupil, catch-light(s)
    const lashes = [...svg.querySelectorAll('path')].find((p) => (p.getAttribute('d').match(/M/g) || []).length >= 4 && p.getAttribute('d').includes('Q'));
    expect(lashes).toBeTruthy();
    expect(Number(lashes.getAttribute('stroke-width'))).toBeGreaterThanOrEqual(0.9); // still visible at 24px
  });

  it('only the eyelid group is animated, and it lives inside the clipped opening (the icon box itself never moves)', () => {
    const { container } = render(<TekangoEyeIcon />);
    const svg = container.querySelector('svg');
    const lids = svg.querySelectorAll('.tk-eye-lid');
    expect(lids).toHaveLength(1);
    expect(lids[0]).toHaveAttribute('data-part', 'eyelid');
    expect(lids[0].closest('g[clip-path]')).not.toBeNull();
    expect(svg.getAttribute('style')).toBeNull();
  });

  it('gradient and clip ids are unique per instance (two icons on one page never share defs)', () => {
    const { container } = render(<><TekangoEyeIcon /><TekangoEyeIcon /></>);
    const ids = [...container.querySelectorAll('[id]')].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-zA-Z0-9_-]+$/);
  });
});

describe('TekangoEyeIcon blink lives inside the SVG', () => {
  it('ships its own eyelid-only keyframes (7s) and the reduced-motion off-switch inside the svg', () => {
    const { container } = render(<TekangoEyeIcon />);
    const style = container.querySelector('svg > style');
    expect(style).not.toBeNull();
    const css = style.textContent;
    expect(css).toMatch(/\.tk-eye-lid \{[^}]*animation: tk-eye-blink 7s ease-in-out infinite;/);
    expect(css).toMatch(/@keyframes tk-eye-blink/);
    expect(css).not.toMatch(/\.tk-eye \{|scale/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.tk-eye-lid \{ animation: none; \}/);
  });
});
