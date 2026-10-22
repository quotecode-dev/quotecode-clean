// IRON-ICON-001 (law 45; Owner reference 2026-10-23): the TEKANGO AI icon family - one tile + head drawing, two marks.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import TekangoAiIcon from './TekangoAiIcon';

describe('TekangoAiIcon', () => {
  it('one drawing (tile, rim, head) with the customer question mark or the chat star; inline SVG, decorative', () => {
    const { container } = render(<><TekangoAiIcon size={24} variant="customer" /><TekangoAiIcon size={18} variant="chat" /></>);
    const [a, b] = container.querySelectorAll('svg');
    expect(a.dataset.tekangoAiIcon).toBe('customer');
    expect(b.dataset.tekangoAiIcon).toBe('chat');
    for (const svg of [a, b]) {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('viewBox')).toBe('0 0 48 48');
    }
    expect(a.getAttribute('width')).toBe('24');
    expect(a.querySelector('circle[cx="24.5"]')).toBeTruthy(); // the question mark's dot
    expect(b.querySelector('circle[cx="24.5"]')).toBeNull();
    expect(container.querySelector('img, image')).toBeNull();
  });
  it('several icons never share gradient / filter ids', () => {
    const { container } = render(<><TekangoAiIcon /><TekangoAiIcon variant="chat" /></>);
    const ids = [...container.querySelectorAll('[id]')].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('the Customer check entries and panel use it (no generic sparkle, not the old robot)', () => {
    for (const f of ['src/components/CustomerTwinPanel.jsx', 'src/components/QuoteForm.jsx', 'src/components/QuotesTab.jsx']) {
      const s = readFileSync(f, 'utf8');
      expect(s, f).toMatch(/<TekangoAiIcon size=\{\d+\} variant="customer" \/>/);
      expect(s, f).not.toMatch(/Sparkles|<AiRobotIcon/);
    }
  });
});
