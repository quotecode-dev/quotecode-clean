// Night task 2026-11-16 (Owner typed the night-task line, L-09, item 1; the rule - Owner 14/11): a sample text longer than its typing field
// slides inside it once (first word -> its end -> back, stop), never a loop; "reduce motion" = still; typing / focus stops it at once.
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planSlide, installPlaceholderSlide } from './utils/placeholderSlide';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(HERE, p), 'utf8');

describe('the plan: how far and how long', () => {
  it('a text that fits does not move; a longer one slides by its overflow, slowly (40px a second, 1.5-8 seconds)', () => {
    expect(planSlide(100, 120)).toBeNull();
    expect(planSlide(121, 120)).toBeNull(); // one pixel is rounding, not a cut word
    expect(planSlide(200, 120)).toEqual({ over: 80, seconds: 2 });
    expect(planSlide(140, 120)).toEqual({ over: 20, seconds: 1.5 });
    expect(planSlide(1000, 120)).toEqual({ over: 880, seconds: 8 });
    expect(planSlide(200, 0)).toBeNull();
  });
});

describe('the runtime', () => {
  it('"reduce motion": nothing is installed', () => {
    const win = { setTimeout, clearTimeout, getComputedStyle: () => ({}), matchMedia: () => ({ matches: true }), addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const off = installPlaceholderSlide(document.body, win);
    expect(win.addEventListener).not.toHaveBeenCalled();
    off();
  });
  it('no layout engine (no canvas measure): a field is never moved, and the cleanup is safe', async () => {
    document.body.innerHTML = '<input placeholder="e.g. Installation, handles, or a window screen" />';
    const off = installPlaceholderSlide(document.body, window);
    await new Promise((r) => setTimeout(r, 300));
    expect(document.querySelector('input').style.textIndent).toBe('');
    off();
  });
  it('the app installs it once for every typing field; the moving text is the field\'s own text-indent, reset on focus / input', () => {
    const d = read('pages/Dashboard.jsx');
    // + 16/11 afternoon (Owner typed "... סלייד לטקסט ארוך בכל שדה במערכת ..."): the value slide comes from the same file
    expect(d).toContain("import { installPlaceholderSlide, installValueSlide } from '../utils/placeholderSlide';");
    expect(d).toContain('useEffect(() => (typeof document !== \'undefined\' ? installPlaceholderSlide(document.body) : undefined), []);');
    const s = read('utils/placeholderSlide.js');
    expect(s).toContain("prefers-reduced-motion: reduce");
    expect(s).toContain("el.addEventListener('focus', stop); el.addEventListener('input', stop);");
    expect(s).toContain('el.style.textIndent = `-${plan.over}px`;');
    expect(s).toContain("el.style.textIndent = '0px';");
  });
});
