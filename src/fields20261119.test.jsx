// Owner console 2026-11-19, typed: "מאשר, כולל L-09, עד הלייב" over the plan: nothing moves in a field; a long text shows its start and ends
// with "…" at the field edge; on a computer a mouse over the field shows the whole text in the system's small dark bubble; a click starts
// the normal editing (the "…" goes, the whole text scrolls); no sample text is longer than its field on a phone.
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fieldHiddenText, installFieldBubble } from './utils/fieldFullText';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(here, f), 'utf8');
const W = 120; // the field's inner width in these tests
const measure = (text) => String(text).length * 10; // 10px a character
const field = (html) => {
  document.body.innerHTML = html;
  const el = document.body.querySelector('input');
  Object.defineProperty(el, 'clientWidth', { get: () => W });
  return el;
};
const over = (el, pointerType = 'mouse') => { const e = new Event('pointerover', { bubbles: true }); e.pointerType = pointerType; el.dispatchEvent(e); };
const out = (el) => { const e = new Event('pointerout', { bubbles: true }); e.pointerType = 'mouse'; el.dispatchEvent(e); };
afterEach(() => { document.body.innerHTML = ''; });

describe('nothing moves in a field any more (the 16/11 slide is gone)', () => {
  it('no slide module, no slide install, the hover bubble is installed instead', () => {
    expect(fs.existsSync(path.join(here, 'utils/placeholderSlide.js'))).toBe(false);
    const d = read('pages/Dashboard.jsx');
    expect(d).toContain("import { installFieldBubble } from '../utils/fieldFullText';");
    expect(d).toContain("useEffect(() => (typeof document !== 'undefined' ? installFieldBubble(document.body) : undefined), []);");
    expect(d).not.toMatch(/installValueSlide|installPlaceholderSlide|placeholderSlide/);
  });
  it('a text field that is not being typed in ends a long text with "…" (a value or a sample text)', () => {
    expect(read('index.css')).toContain('input:not([type]):not(:focus), input[type="text"]:not(:focus), input[type="search"]:not(:focus), input[type="email"]:not(:focus), input[type="tel"]:not(:focus), input[type="url"]:not(:focus), input:placeholder-shown { text-overflow: ellipsis; }');
  });
});

describe('the whole text of a long field', () => {
  it('only a text longer than the field; the value first, else the sample text; not a number field', () => {
    expect(fieldHiddenText(field('<input value="short" />'), window, measure)).toBeNull();
    expect(fieldHiddenText(field('<input type="email" value="avraham.rosenthal@gmail.com" />'), window, measure)).toBe('avraham.rosenthal@gmail.com');
    expect(fieldHiddenText(field('<input placeholder="a very long sample text here" />'), window, measure)).toBe('a very long sample text here');
    expect(fieldHiddenText(field('<input type="number" value="123456789012345678" />'), window, measure)).toBeNull();
  });
});

describe('the hover bubble', () => {
  it('a mouse over a long field shows its whole text; leaving it, a click or typing hides it', () => {
    const el = field('<input type="email" value="avraham.rosenthal.renovations@gmail.com" />');
    const off = installFieldBubble(document.body, window, measure);
    over(el);
    const tip = document.querySelector('[data-testid="field-bubble"]');
    expect(tip.textContent).toBe('avraham.rosenthal.renovations@gmail.com');
    expect(tip.getAttribute('role')).toBe('tooltip');
    expect(tip.className).toBe('pf-ell-bubble');
    out(el);
    expect(document.querySelector('[data-testid="field-bubble"]')).toBeNull();
    over(el);
    el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(document.querySelector('[data-testid="field-bubble"]')).toBeNull();
    off();
  });
  it('no bubble for a field that fits, for a touch, or while the field is being typed in', () => {
    const off = installFieldBubble(document.body, window, measure);
    const short = field('<input value="short" />');
    over(short);
    expect(document.querySelector('[data-testid="field-bubble"]')).toBeNull();
    const long = field('<input value="a very long value inside the field" />');
    over(long, 'touch');
    expect(document.querySelector('[data-testid="field-bubble"]')).toBeNull();
    long.focus();
    over(long);
    expect(document.querySelector('[data-testid="field-bubble"]')).toBeNull();
    off();
  });
});

// the agent review of 19/11: a long e-mail in the bubble broke inside a word ("…gmail.co" / "m") - wider room, breaks only after . @ - _ /
describe('a long e-mail in the bubble never breaks inside a word', () => {
  it('the bubble has wider room and offers a break only after . @ - _ /', () => {
    const css = read('index.css');
    expect(css).toContain('.pf-ell-bubble { z-index: 2147483000; max-width: min(480px, calc(100vw - 32px));');
    expect(css).toContain('white-space: normal; overflow-wrap: break-word; pointer-events: none; text-align: start; }');
    const el = field('<input type="email" value="rodriguez.whitfield@gmail.com" />');
    const off = installFieldBubble(document.body, window, measure);
    over(el);
    const tip = document.querySelector('[data-testid="field-bubble"]');
    expect(tip.textContent).toBe('rodriguez.whitfield@gmail.com');
    expect([...tip.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent)).toEqual(['rodriguez.', 'whitfield@', 'gmail.', 'com']);
    expect(tip.querySelectorAll('wbr').length).toBe(4);
    off();
    expect(read('components/EllipsisText.jsx')).toContain("{bubbleContent ?? breakable(full)}");
  });
});

// the agent review of 19/11: the "choose an existing client" drop-down cut a long chosen name without "…"
describe('a drop-down with a long chosen option', () => {
  it('ends it with "…" before the arrow and shows the whole option on hover', () => {
    expect(read('index.css')).toContain('select { text-overflow: ellipsis; }');
    document.body.innerHTML = '<select><option value="a">The Rodriguez-Whitfield Family, 14 Herzl Street</option></select>';
    const el = document.body.querySelector('select');
    Object.defineProperty(el, 'clientWidth', { get: () => W });
    expect(fieldHiddenText(el, window, measure)).toBe('The Rodriguez-Whitfield Family, 14 Herzl Street');
    const off = installFieldBubble(document.body, window, measure);
    over(el);
    expect(document.querySelector('[data-testid="field-bubble"]').textContent).toBe('The Rodriguez-Whitfield Family, 14 Herzl Street');
    off();
    document.body.innerHTML = '<select><option>Short</option></select>';
    const s2 = document.body.querySelector('select'); Object.defineProperty(s2, 'clientWidth', { get: () => W });
    expect(fieldHiddenText(s2, window, measure)).toBeNull();
  });
});
