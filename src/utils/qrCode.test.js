// Task 23: the dependency-free QR encoder (src/utils/qrCode.js) for the digital business card.
// __fixtures__/qrReference.json holds module matrices produced by an independent reference encoder (qrcode-generator 1.4.4, level M,
// byte mode, UTF-8) - generated once outside the product; the product never depends on that library.
import { describe, it, expect } from 'vitest';
import { encodeQr, rsRemainder, formatBits, versionBits, penalty, qrSvgPath, MAX_VERSION } from './qrCode';
import REFERENCE from './__fixtures__/qrReference.json';

const maskFromFormat = (m) => {
  let fb = 0;
  for (let i = 0; i <= 5; i++) fb |= (m[i][8] ? 1 : 0) << i;
  fb |= (m[7][8] ? 1 : 0) << 6; fb |= (m[8][8] ? 1 : 0) << 7; fb |= (m[8][7] ? 1 : 0) << 8;
  for (let i = 9; i < 15; i++) fb |= (m[8][14 - i] ? 1 : 0) << i;
  return [0, 1, 2, 3, 4, 5, 6, 7].find((k) => formatBits(k) === fb);
};

describe('QR encoder building blocks', () => {
  it('Reed-Solomon: the ISO/Thonky "HELLO WORLD" 1-M example', () => {
    expect(rsRemainder([32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17], 10)).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });
  it('format information for level M, masks 0-7 (ISO table)', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((k) => formatBits(k).toString(2).padStart(15, '0'))).toEqual([
      '101010000010010', '101000100100101', '101111001111100', '101101101001011', '100010111111001', '100000011001110', '100111110010111', '100101010100000',
    ]);
  });
  it('version information (BCH 18,6) for version 7', () => {
    expect(versionBits(7).toString(2).padStart(18, '0')).toBe('000111110010010100');
  });
});

describe('module-for-module equality with an independent reference encoder', () => {
  it.each(Object.keys(REFERENCE))('%s', (text) => {
    const ref = REFERENCE[text].map((row) => [...row].map((c) => c === '1'));
    const mine = encodeQr(text, { mask: maskFromFormat(ref) });
    expect(mine.size).toBe(ref.length);
    expect(mine.modules.map((r) => r.map((x) => (x ? '1' : '0')).join(''))).toEqual(REFERENCE[text]);
  });
});

describe('encodeQr', () => {
  it('picks the smallest version and the lowest-penalty mask', () => {
    const url = 'https://www.tekango.com/card/00000000-0000-4000-8000-0000000000a1';
    const q = encodeQr(url);
    expect(q.version).toBe(5);
    expect(q.size).toBe(37);
    const scores = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => penalty(encodeQr(url, { mask: k }).modules));
    expect(penalty(q.modules)).toBe(Math.min(...scores));
  });
  it('refuses text longer than version 10 allows', () => {
    expect(() => encodeQr('x'.repeat(214))).toThrow('QR_TEXT_TOO_LONG');
    expect(encodeQr('x'.repeat(213)).version).toBe(MAX_VERSION);
  });
  it('renders one SVG path with a 4-module quiet zone', () => {
    const d = qrSvgPath(encodeQr('A').modules);
    expect(d.startsWith('M4 4h1v1h-1z')).toBe(true); // top-left finder corner
    expect(d).not.toMatch(/M[0-3] /);
  });
});
