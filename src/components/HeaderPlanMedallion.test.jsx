// Owner 2026-10-14: the round header plan medallion (earlier medallion language, modern restrained motion).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import HeaderPlanMedallion, { MEDALLION_INTRO_MS, MEDALLION_POP_MS } from './HeaderPlanMedallion';
import { planBadgeModel } from '../domain/subscriptions/accountSummaryClient';

afterEach(() => { cleanup(); vi.useRealTimers(); });
const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'headerPlanMedallion.css'), 'utf8');

describe('HeaderPlanMedallion', () => {
  it.each([
    ['lifetime', { state: 'not_activated' }, { isLifetime: true }, '#b07604', 'לכל החיים'],
    ['plans', { state: 'not_activated' }, {}, '#0f6672', 'מסלולים'],
    ['free10', { state: 'ready', planId: 'free', free10: { remaining: 7 }, phase: { output: 'enforced' } }, {}, '#15803d', 'נותרו 7/10'],
  ])('%s: its color, the plan name in the bubble and in the accessible name; the click opens the plans window', (kind, summary, opts, color, label) => {
    const onOpen = vi.fn();
    const { getByTestId } = render(<HeaderPlanMedallion model={planBadgeModel(summary, 'he', opts)} isHebrew onOpen={onOpen} />);
    const b = getByTestId('header-plan-button');
    expect(b.dataset.planKind).toBe(kind);
    expect(b.style.getPropertyValue('--hpm-ink')).toBe(color);
    expect(b.querySelector('svg.hpm-ring .hpm-arc')).not.toBeNull();
    expect(b.getAttribute('aria-label')).toBe(`${label} - פתיחת חלון המסלולים`);
    expect(b.querySelector('.hpm-bubble').textContent).toBe(label);
    expect(b.classList.contains('hpm--progress')).toBe(kind === 'free10');
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
  it('css: 40px round slot, the ring arc follows the ratio, bubble under the disc toward the inside, reduced motion = no motion', () => {
    expect(css).toMatch(/\.hpm \{[^}]*inline-size: 40px;[^}]*block-size: 40px;[^}]*border-radius: 50%;/);
    expect(css).toMatch(/\.hpm-bubble \{[^}]*inset-block-start: calc\(100% \+ 9px\);[^}]*inset-inline-end: -2px;/);
    expect(css).toContain('stroke-dashoffset: calc(100 - var(--hpm-ratio) * 100);');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*animation: none !important;/);
  });
});

// Owner 2026-11-11 (finding 8, typed L-03): the caption with the free days left, the orange ring, the pop after a counted quote, a tap
describe('the Free-10 counter inside the medallion', () => {
  const model = { kind: 'free10', label: '10 הצעות חינם · 8/10 נוצלו', remaining: 2, total: 10 };
  it('the caption replaces the bubble words and the aria label', () => {
    const { getByTestId } = render(<HeaderPlanMedallion model={model} caption="10 הצעות חינם · 8/10 נוצלו · עוד 4 ימים" isHebrew onOpen={() => {}} />);
    const b = getByTestId('header-plan-button');
    expect(b.querySelector('.hpm-bubble').textContent).toBe('10 הצעות חינם · 8/10 נוצלו · עוד 4 ימים');
    expect(b.getAttribute('aria-label')).toBe('10 הצעות חינם · 8/10 נוצלו · עוד 4 ימים - פתיחת חלון המסלולים');
  });
  it('warn: the ring turns orange', () => {
    const { getByTestId } = render(<HeaderPlanMedallion model={model} warn isHebrew onOpen={() => {}} />);
    const b = getByTestId('header-plan-button');
    expect(b.className).toContain('hpm--warn');
    expect([...b.querySelectorAll('stop')].map((x) => x.getAttribute('stop-color'))).toEqual(['#fb923c', '#ea580c']);
  });
  it('a counted quote (popKey change) shows the caption for a few seconds; the first value does not', () => {
    vi.useFakeTimers();
    const { getByTestId, rerender } = render(<HeaderPlanMedallion model={model} popKey={7} isHebrew onOpen={() => {}} />);
    act(() => { vi.advanceTimersByTime(MEDALLION_INTRO_MS + 10); });
    expect(getByTestId('header-plan-button').className).not.toContain('hpm--show');
    rerender(<HeaderPlanMedallion model={model} popKey={8} isHebrew onOpen={() => {}} />);
    expect(getByTestId('header-plan-button').className).toContain('hpm--show');
    act(() => { vi.advanceTimersByTime(MEDALLION_POP_MS + 10); });
    expect(getByTestId('header-plan-button').className).not.toContain('hpm--show');
    vi.useRealTimers();
  });
  it('a tap first shows the caption, the next tap opens the plans; a mouse click opens at once', () => {
    const onOpen = vi.fn();
    const { getByTestId } = render(<HeaderPlanMedallion model={model} isHebrew onOpen={onOpen} />);
    const b = getByTestId('header-plan-button');
    fireEvent.pointerDown(b, { pointerType: 'touch' }); fireEvent.click(b);
    expect(onOpen).not.toHaveBeenCalled();
    expect(b.className).toContain('hpm--show');
    fireEvent.pointerDown(b, { pointerType: 'touch' }); fireEvent.click(b);
    expect(onOpen).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(b, { pointerType: 'mouse' }); fireEvent.click(b);
    expect(onOpen).toHaveBeenCalledTimes(2);
  });
});
