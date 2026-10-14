// Task 38 (Owner: the floating AI launcher covered FAQ answer text on mobile): regression for the approved step-aside mechanism.
// Geometry is stubbed (jsdom has no layout); the real-browser proof is evidence/task38/overlap/overlap-probe-t38.mjs.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useRef } from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { coversProtected, useLauncherStepAside, LAUNCHER_RETURN_DELAY_MS } from './useLauncherStepAside';

const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top });
const LAUNCHER = rect(20, 700, 120, 48); // bottom-start corner of a phone
const fakeDoc = (lines) => ({ createRange: () => ({ selectNodeContents: () => {}, getClientRects: () => lines }) });
const el = (tag, box, cls = '') => { const e = document.createElement(tag); e.className = cls; e.getBoundingClientRect = () => box; return e; };

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('coversProtected', () => {
  it('a paragraph whose drawn line runs under the launcher is covered (the observed FAQ defect)', () => {
    expect(coversProtected(LAUNCHER, el('p', rect(0, 680, 390, 60)), fakeDoc([rect(10, 700, 370, 22)]))).toBe(true);
  });
  it('a paragraph whose box reaches the corner but whose short RTL line does not is free (the launcher is not hidden for nothing)', () => {
    expect(coversProtected(LAUNCHER, el('p', rect(0, 680, 390, 60)), fakeDoc([rect(250, 700, 130, 22)]))).toBe(false);
  });
  it('an open FAQ answer (.tl-faq-a) is measured by its text lines, including its bullet items', () => {
    const answer = el('div', rect(0, 600, 390, 200), 'tl-faq-a');
    expect(coversProtected(LAUNCHER, answer, fakeDoc([rect(200, 610, 180, 20), rect(30, 712, 340, 20)]))).toBe(true);
    expect(coversProtected(LAUNCHER, answer, fakeDoc([rect(200, 610, 180, 20)]))).toBe(false);
  });
  it('controls, headings and the approved visuals (.tl-doc) keep box protection', () => {
    for (const e of [el('a', rect(0, 690, 390, 40)), el('h2', rect(0, 690, 390, 40)), el('div', rect(0, 600, 390, 300), 'tl-doc')]) {
      expect(coversProtected(LAUNCHER, e, fakeDoc([]))).toBe(true);
    }
  });
  it('anything away from the launcher is free', () => {
    expect(coversProtected(LAUNCHER, el('a', rect(0, 100, 390, 40)), fakeDoc([]))).toBe(false);
  });
});

function Harness({ covered }) {
  const ref = useRef(null);
  useLauncherStepAside(ref, '.prot', 'aside');
  return (
    <div ref={ref} data-testid="root">
      <button className="ai-support-btn" ref={(b) => { if (b) b.getBoundingClientRect = () => LAUNCHER; }}>AI</button>
      <a className="prot" href="#x" ref={(a) => { if (a) a.getBoundingClientRect = () => (covered.now ? rect(0, 690, 390, 40) : rect(0, 100, 390, 40)); }}>x</a>
    </div>
  );
}

describe('useLauncherStepAside: hysteresis + FAQ toggle', () => {
  it('steps aside at once; returns only after the spot stayed free for the return delay (no flicker in short gaps)', async () => {
    vi.useFakeTimers();
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => setTimeout(() => cb(0), 0));
    const covered = { now: true };
    const { getByTestId } = render(<Harness covered={covered} />);
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(getByTestId('root').classList.contains('aside')).toBe(true);
    covered.now = false; // a short gap between two paragraphs
    await act(async () => { window.dispatchEvent(new Event('scroll')); vi.advanceTimersByTime(1); });
    expect(getByTestId('root').classList.contains('aside')).toBe(true); // still aside inside the delay
    covered.now = true; // the next paragraph arrives before the delay ends
    await act(async () => { window.dispatchEvent(new Event('scroll')); vi.advanceTimersByTime(LAUNCHER_RETURN_DELAY_MS + 5); });
    expect(getByTestId('root').classList.contains('aside')).toBe(true); // never shown in the gap
    covered.now = false; // at rest in a free spot
    await act(async () => { window.dispatchEvent(new Event('scroll')); vi.advanceTimersByTime(LAUNCHER_RETURN_DELAY_MS + 5); });
    expect(getByTestId('root').classList.contains('aside')).toBe(false); // back
    raf.mockRestore();
  });
  it('a FAQ answer opening under the launcher re-checks at once (toggle event, no scroll needed)', async () => {
    vi.useFakeTimers();
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => setTimeout(() => cb(0), 0));
    const covered = { now: false };
    const { getByTestId } = render(<Harness covered={covered} />);
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(getByTestId('root').classList.contains('aside')).toBe(false);
    covered.now = true; // the answer opened and its text now runs under the launcher
    await act(async () => { getByTestId('root').querySelector('a').dispatchEvent(new Event('toggle')); vi.advanceTimersByTime(1); });
    expect(getByTestId('root').classList.contains('aside')).toBe(true);
    raf.mockRestore();
  });
});
