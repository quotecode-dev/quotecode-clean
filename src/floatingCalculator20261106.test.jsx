// Owner console 2026-11-06 (release C, typed approval incl. L-09): a floating Calculator button in the quote editor ("שיצוף תמיד ... בהכנת
// הצעה ובעריכת הצעה"), for calculation only; the calculator moves with a finger too ("או לפחות להזיז אותו גם הנייד") and stays on screen.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import DraggableCalculator, { clampCalcPos } from './components/DraggableCalculator';

afterEach(cleanup);

describe('the calculator stays inside the screen', () => {
  it('clampCalcPos keeps it fully across and its top bar down', () => {
    expect(clampCalcPos({ x: -50, y: -10 }, 390, 844)).toEqual({ x: 0, y: 0 });
    expect(clampCalcPos({ x: 500, y: 2000 }, 390, 844)).toEqual({ x: 50, y: 800 });
    expect(clampCalcPos({ x: 100, y: 100 }, 1440, 900)).toEqual({ x: 100, y: 100 });
    expect(clampCalcPos({ x: 30, y: 0 }, 320, 600)).toEqual({ x: 0, y: 0 }); // narrower than the calculator: pinned to the start
  });
});

describe('dragging works with a finger (pointer events), not only a mouse', () => {
  it('a touch drag on the top bar moves it; the page does not scroll; it never leaves the screen', () => {
    window.innerWidth = 390; window.innerHeight = 844;
    render(<DraggableCalculator isOpen onClose={() => {}} isHebrew currency="ILS" />);
    const bar = screen.getByTestId('calc-drag-bar');
    expect(bar.style.touchAction).toBe('none');
    const box = bar.parentElement;
    const start = { left: parseFloat(box.style.left), top: parseFloat(box.style.top) };
    act(() => { fireEvent.pointerDown(bar, { pointerType: 'touch', button: 0, clientX: 100, clientY: 100 }); });
    act(() => { fireEvent.pointerMove(window, { pointerType: 'touch', clientX: 100, clientY: 160 }); });
    act(() => { fireEvent.pointerUp(window, { pointerType: 'touch' }); });
    expect(parseFloat(box.style.top)).toBe(start.top + 60);
    act(() => { fireEvent.pointerDown(bar, { pointerType: 'touch', button: 0, clientX: 100, clientY: 100 }); });
    act(() => { fireEvent.pointerMove(window, { pointerType: 'touch', clientX: 900, clientY: 5000 }); });
    act(() => { fireEvent.pointerUp(window, { pointerType: 'touch' }); });
    expect(parseFloat(box.style.left)).toBe(50);
    expect(parseFloat(box.style.top)).toBe(800);
  });
  it('a press on the close button never starts a drag (the close keeps working as before)', () => {
    let closed = 0;
    render(<DraggableCalculator isOpen onClose={() => { closed += 1; }} isHebrew={false} currency="USD" />);
    const bar = screen.getByTestId('calc-drag-bar');
    const close = bar.querySelector('button');
    const top = bar.parentElement.style.top;
    act(() => { fireEvent.pointerDown(close, { button: 0, clientX: 10, clientY: 10 }); });
    act(() => { fireEvent.pointerMove(window, { clientX: 10, clientY: 300 }); });
    expect(bar.parentElement.style.top).toBe(top);
    fireEvent.click(close);
    expect(closed).toBe(1);
  });
});

describe('the floating button in the quote editor', () => {
  it('QuoteForm renders one floating Calculator button that opens the same calculator (no transfer to a field)', () => {
    const src = readFileSync('src/components/QuoteForm.jsx', 'utf8');
    expect(src.match(/className="pf-calc-fab"/g)).toHaveLength(1);
    expect(src).toContain('<button type="button" className="pf-calc-fab" onClick={() => setIsCalcOpen(true)}');
    expect(src).toContain("aria-label={isHebrew ? 'מחשבון' : 'Calculator'}");
    // the small link stays (Locked Decision 2)
    expect(src).toContain("{isHebrew ? 'מחשבון' : 'Calculator'}\n              </button>".replace(/\n/g, src.includes('\r\n') ? '\r\n' : '\n'));
  });
  it('it floats above the windows that open over the editor (z 10000) and below the calculator; above the phone bottom bar', () => {
    const css = readFileSync('src/index.css', 'utf8');
    expect(css).toMatch(/\.pf-calc-fab \{ position: fixed; inset-inline-end: 18px; bottom: 24px; z-index: 10001;/);
    expect(css).toMatch(/@media \(max-width: 768px\) \{ \.pf-calc-fab \{ bottom: calc\(104px/);
  });
});
