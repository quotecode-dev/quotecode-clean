// Owner 2026-10-14: the round header plan medallion (earlier medallion language, modern restrained motion).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import HeaderPlanMedallion, { MEDALLION_INTRO_MS } from './HeaderPlanMedallion';
import { planBadgeModel } from '../domain/subscriptions/accountSummaryClient';

afterEach(() => { cleanup(); vi.useRealTimers(); });
const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'headerPlanMedallion.css'), 'utf8');

describe('HeaderPlanMedallion', () => {
  it.each([
    ['lifetime', { state: 'not_activated' }, { isLifetime: true }, '#b7791f', 'לכל החיים'],
    ['plans', { state: 'not_activated' }, {}, '#0f6672', 'מסלולים'],
    ['free10', { state: 'ready', planId: 'free', free10: { remaining: 7 }, phase: { output: 'enforced' } }, {}, '#059669', 'נותרו 7/10'],
  ])('%s: its color, the plan name in the bubble and in the accessible name; the click opens the plans window', (kind, summary, opts, color, label) => {
    const onOpen = vi.fn();
    const { getByTestId } = render(<HeaderPlanMedallion model={planBadgeModel(summary, 'he', opts)} isHebrew onOpen={onOpen} />);
    const b = getByTestId('header-plan-button');
    expect(b.dataset.planKind).toBe(kind);
    expect(b.style.getPropertyValue('--hpm-color')).toBe(color);
    expect(b.getAttribute('aria-label')).toBe(`${label} - פתיחת חלון המסלולים`);
    expect(b.querySelector('.hpm-bubble').textContent).toBe(label);
    expect(!!b.querySelector('.hpm-progress')).toBe(kind === 'free10');
    fireEvent.click(b);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
  it('Free-10 progress = remaining / total', () => {
    const { getByTestId } = render(<HeaderPlanMedallion model={{ kind: 'free10', label: '3/10 left', remaining: 3, total: 10 }} isHebrew={false} onOpen={() => {}} />);
    expect(getByTestId('header-plan-button').style.getPropertyValue('--hpm-ratio')).toBe('0.3');
  });
  it('the arrival intro (pop, sweep, bubble) ends by itself', () => {
    vi.useFakeTimers();
    const { getByTestId } = render(<HeaderPlanMedallion model={{ kind: 'lifetime', label: 'Lifetime' }} isHebrew={false} onOpen={() => {}} />);
    expect(getByTestId('header-plan-button').className).toContain('hpm--intro');
    act(() => { vi.advanceTimersByTime(MEDALLION_INTRO_MS + 10); });
    expect(getByTestId('header-plan-button').className).not.toContain('hpm--intro');
  });
  it('css: 36px round slot, bubble under the disc toward the inside, reduced motion = no motion', () => {
    expect(css).toMatch(/\.hpm \{[^}]*inline-size: 36px;[^}]*block-size: 36px;[^}]*border-radius: 50%;/);
    expect(css).toMatch(/\.hpm-bubble \{[^}]*inset-block-start: calc\(100% \+ 9px\);[^}]*inset-inline-end: -4px;/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*animation: none;/);
  });
});
