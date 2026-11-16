// Owner console 2026-11-16 (typed release line "מאשר שחרור תיקוני הבדיקה באתר על 220: משולש "סיכום ההצעה" בעברית בתחילת המילים, סלייד לטקסט
// ארוך בכל שדה במערכת, "data:image/png…" בשדה הלוגו, ...").
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logoFieldText, nextLogoValue } from './utils/logoFieldText';
import { planValueSlide, installValueSlide } from './utils/placeholderSlide';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(here, f), 'utf8');

describe('"סיכום ההצעה": the triangle at the start of the words in Hebrew', () => {
  it('the button has its own direction (Hebrew right-to-left, English left-to-right) and the triangle comes first', () => {
    const q = read('components/QuoteForm.jsx');
    expect(q).toContain('<button type="button" className="sq-add-btn" dir={isHebrew ? \'rtl\' : \'ltr\'} aria-expanded={summaryOpen} data-testid="qt-summary-toggle" onClick={toggleSummary}><span className="qt-summary-tri"');
  });
});

describe('the logo field: a file\'s code shows as "data:image/png…"', () => {
  const CODE = `data:image/png;base64,${'iVBORw0KGgo'.repeat(400)}`;
  it('shows the short start; a web address as it is', () => {
    expect(logoFieldText(CODE)).toBe('data:image/png…');
    expect(logoFieldText('data:image/svg+xml;base64,AAAA')).toBe('data:image/svg+xml…');
    expect(logoFieldText('https://example.com/logo.png')).toBe('https://example.com/logo.png');
    expect(logoFieldText('')).toBe('');
  });
  it('an edit inside the short code keeps the logo; a typed address replaces it; an empty field clears it', () => {
    expect(nextLogoValue(CODE, 'data:image/pn')).toBe(CODE);
    expect(nextLogoValue(CODE, 'https://x.com/a.png')).toBe('https://x.com/a.png');
    expect(nextLogoValue(CODE, '')).toBe('');
    expect(nextLogoValue('https://a', 'https://ab')).toBe('https://ab');
  });
  it('Business settings uses it', () => {
    const s = read('components/SettingsTab.jsx');
    expect(s).toContain('value={logoFieldText(bizLogoUrl)}');
    expect(s).toContain('onChange={(e) => setBizLogoUrl(nextLogoValue(bizLogoUrl, e.target.value))}');
  });
});

describe('a long value in any field slides (never cut)', () => {
  afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); vi.useRealTimers(); });
  it('planValueSlide: only a value longer than its field', () => {
    expect(planValueSlide(100, 200)).toBeNull();
    expect(planValueSlide(300, 200)).toEqual({ over: 100, ms: 12000 });
  });
  it('a long value moves back and forth while the field is not edited; focus stops it; the app installs it', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<input type="email" value="tekangointernational@gmail.com" />';
    const el = document.querySelector('input');
    Object.defineProperty(el, 'offsetParent', { get: () => document.body });
    Object.defineProperty(el, 'clientWidth', { get: () => 120 });
    const anim = { cancel: vi.fn() }; el.animate = vi.fn(() => anim);
    const ctx = { measureText: () => ({ width: 300 }) };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    const off = installValueSlide(document.body, window);
    vi.advanceTimersByTime(300);
    expect(el.animate).toHaveBeenCalledTimes(1);
    const [, opts] = el.animate.mock.calls[0];
    expect(opts).toMatchObject({ iterations: Infinity, direction: 'alternate' });
    el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(anim.cancel).toHaveBeenCalled();
    off();
    expect(read('pages/Dashboard.jsx')).toContain('installValueSlide(document.body)');
  });
});
