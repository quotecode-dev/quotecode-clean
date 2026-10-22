// IRON-ICON-001 (law 45; Owner choices 2026-10-23): the AI chat icon (a glowing head with "AI" in a tile) and the Customer Twin mark
// (two heads and a lens, flat two-tone; white on a blue button).
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import TekangoAiIcon from './TekangoAiIcon';
import CustomerTwinIcon from './CustomerTwinIcon';

describe('TEKANGO AI icons', () => {
  it('the AI chat icon: a tile and a head with drawn "AI" letters (no font, no question mark); inline SVG, decorative', () => {
    const { container } = render(<TekangoAiIcon size={22} />);
    const svg = container.querySelector('svg[data-tekango-ai-icon="ai"]');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('width')).toBe('22');
    expect(svg.querySelectorAll('[data-mark="ai"] path')).toHaveLength(3);
    expect(container.querySelector('text, img, image')).toBeNull();
  });
  it('the Customer Twin mark: two heads and a lens, two tones; light for a blue button', () => {
    const { container } = render(<><CustomerTwinIcon size={64} /><CustomerTwinIcon size={22} tone="light" /></>);
    const [color, light] = container.querySelectorAll('svg');
    expect(color.dataset.customerTwinIcon).toBe('color');
    expect(light.dataset.customerTwinIcon).toBe('light');
    expect([...color.querySelectorAll('g path')].map((p) => p.getAttribute('fill'))).toEqual(['#2563EB', '#4338CA']);
    expect([...light.querySelectorAll('g path')].map((p) => p.getAttribute('fill'))).toEqual(['#DBE7FF', '#FFFFFF']);
    expect(color.querySelector('circle[r="5.9"]')).toBeTruthy(); // the lens
  });
  it('several icons never share gradient / mask ids', () => {
    const { container } = render(<><TekangoAiIcon /><TekangoAiIcon /><CustomerTwinIcon /><CustomerTwinIcon /></>);
    const ids = [...container.querySelectorAll('[id]')].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('the Customer check entries and panel use the Customer Twin mark (no generic sparkle, not the old robot)', () => {
    for (const f of ['src/components/CustomerTwinPanel.jsx', 'src/components/QuoteForm.jsx', 'src/components/QuotesTab.jsx']) {
      const s = readFileSync(f, 'utf8');
      expect(s, f).toMatch(/<CustomerTwinIcon size=\{\d+\}/);
      expect(s, f).not.toMatch(/Sparkles|<AiRobotIcon|<TekangoAiIcon/);
    }
  });
});
