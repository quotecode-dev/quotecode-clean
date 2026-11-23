import { describe, it, expect } from 'vitest';
import { isolateSizes, stripIsolates } from './sizeIsolate';
describe('isolateSizes (a size keeps its order in a Hebrew line)', () => {
  it('wraps every size in an LTR isolate, once', () => {
    expect(isolateSizes('החלפת חלונות 120×150 ס״מ')).toBe('החלפת חלונות ⁦120×150⁩ ס״מ');
    expect(isolateSizes(isolateSizes('דלת 240x220'))).toBe('דלת ⁦240x220⁩');
    expect(isolateSizes('box 1.5 × 2 × 3 m')).toBe('box ⁦1.5 × 2 × 3⁩ m');
  });
  it('leaves text without a size and non-strings unchanged', () => {
    expect(isolateSizes('התקנה ואיטום')).toBe('התקנה ואיטום');
    expect(isolateSizes('')).toBe(''); expect(isolateSizes(null)).toBe(null);
    expect(stripIsolates('a ⁦1×2⁩')).toBe('a 1×2');
  });
});
