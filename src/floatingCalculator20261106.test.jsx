// Owner console 2026-11-06 (release C, typed approval incl. L-09): a floating Calculator button in the quote editor ("שיצוף תמיד ... בהכנת
// הצעה ובעריכת הצעה"), for calculation only; the calculator moves with a finger too ("או לפחות להזיז אותו גם הנייד") and stays on screen.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import DraggableCalculator from './components/DraggableCalculator';
import { clampCalcPos } from './utils/calcPosition';

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

describe('the calculator button (Owner console 2026-11-20/21 (the simple-quotes sketch is the approved demo; typed L-02 / L-03 / L-04 / L-07 / L-09 / L-11 / L-14 / L-15 / L-19 / L-23 / L-25 / L-26 / L-27 / L-29 only as needed): a header icon on every screen, the sketch)', () => {
  it('the header renders one calculator button that opens the same calculator (no transfer to a field); the editor has no floating one', () => {
    const dash = readFileSync('src/pages/Dashboard.jsx', 'utf8');
    expect(dash).toContain('<button type="button" className="dash-header-calc" data-testid="calc-fab" onClick={() => setIsCalcOpen(true)}');
    expect(dash).toContain("aria-label={isHebrew ? 'מחשבון' : 'Calculator'}");
    expect(dash).toContain('<DraggableCalculator isOpen={isCalcOpen} onClose={() => setIsCalcOpen(false)}');
    // the desktop and the phone header both carry it, before the bell
    expect(dash.match(/\{renderHeaderCalcButton\(\)\}/g)).toHaveLength(2);
    expect(readFileSync('src/components/QuoteForm.jsx', 'utf8')).not.toMatch(/pf-calc-fab|DraggableCalculator/);
  });
  it('the icon is white on the navy header bar', () => {
    const css = readFileSync('src/index.css', 'utf8');
    expect(css).toMatch(/\.dash-header-calc \{ background: none; border: 0; color: #ffffff;/);
    expect(css).not.toMatch(/\.pf-calc-fab \{ position: fixed/);
  });
});
