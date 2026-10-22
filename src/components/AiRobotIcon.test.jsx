import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import AiRobotIcon from './AiRobotIcon';

describe('AiRobotIcon (Task 20 Continuation 2, Owner correction 2026-10-10)', () => {
  it('is an original illustrated inline SVG: gradients, layered shapes, decorative only', () => {
    const { container } = render(<AiRobotIcon size={20} />);
    const svg = container.querySelector('svg[data-ai-robot-icon="illustrated"]');
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('width')).toBe('20');
    expect(svg.querySelectorAll('linearGradient, radialGradient').length).toBeGreaterThanOrEqual(3);
    expect(svg.querySelectorAll('rect, circle, ellipse, path').length).toBeGreaterThanOrEqual(12);
    expect(container.querySelector('img, image')).toBeNull(); // no raster / external asset
  });
  it('two instances never share gradient ids', () => {
    const { container } = render(<><AiRobotIcon /><AiRobotIcon /></>);
    const ids = [...container.querySelectorAll('[id]')].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('the header launcher renders it (and no longer the Lucide outline robot)', () => {
    const dashboard = readFileSync(join(cwd(), 'src', 'pages', 'Dashboard.jsx'), 'utf8');
    expect(dashboard).toMatch(/className="dash-header-ai-btn"[\s\S]{0,500}<AiRobotIcon /);
    expect(dashboard).not.toMatch(/BotMessageSquare/);
  });
});
