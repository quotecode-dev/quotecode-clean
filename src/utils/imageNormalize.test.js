import { describe, it, expect } from 'vitest';
import {
  MAX_SOURCE_BYTES,
  chooseOutputMime,
  computeTargetSize,
  normalizeImage,
  precheckSource,
  sniffMime,
} from './imageNormalize';

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

describe('sniffMime', () => {
  it('detects JPEG / PNG / WebP magic bytes', () => {
    expect(sniffMime(new Uint8Array(JPEG))).toBe('image/jpeg');
    expect(sniffMime(new Uint8Array(PNG))).toBe('image/png');
    expect(sniffMime(new Uint8Array(WEBP))).toBe('image/webp');
  });
  it('rejects SVG, GIF, RIFF-but-not-WebP, truncated and empty input', () => {
    expect(sniffMime(new TextEncoder().encode('<svg xmlns="x"></svg>'))).toBe(null);
    expect(sniffMime(new TextEncoder().encode('GIF89a......'))).toBe(null);
    expect(sniffMime(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20]))).toBe(null);
    expect(sniffMime(new Uint8Array([0xff, 0xd8]))).toBe(null);
    expect(sniffMime(new Uint8Array(0))).toBe(null);
    expect(sniffMime(undefined)).toBe(null);
  });
});

describe('computeTargetSize', () => {
  it('never upscales', () => {
    expect(computeTargetSize(800, 600)).toEqual({ width: 800, height: 600, scaled: false });
    expect(computeTargetSize(1600, 1600)).toEqual({ width: 1600, height: 1600, scaled: false });
  });
  it('fits the long side to 1600 keeping aspect ratio', () => {
    expect(computeTargetSize(4000, 3000)).toEqual({ width: 1600, height: 1200, scaled: true });
    expect(computeTargetSize(3000, 6000)).toEqual({ width: 800, height: 1600, scaled: true });
    expect(computeTargetSize(6000, 1)).toEqual({ width: 1600, height: 1, scaled: true });
    expect(computeTargetSize(1000, 500, 500)).toEqual({ width: 500, height: 250, scaled: true });
  });
  it('never lets a side drop below 64 px when the source allows it (review L8)', () => {
    expect(computeTargetSize(4000, 100)).toEqual({ width: 2560, height: 64, scaled: true });
    expect(computeTargetSize(6000, 64)).toEqual({ width: 6000, height: 64, scaled: false });
    expect(computeTargetSize(100, 3200)).toEqual({ width: 64, height: 2048, scaled: true });
    const t = computeTargetSize(5000, 200);
    expect(Math.min(t.width, t.height)).toBeGreaterThanOrEqual(64);
  });
  it('returns null for unusable sizes', () => {
    for (const [w, h] of [[0, 10], [10, -1], [NaN, 5], ['x', 5]]) expect(computeTargetSize(w, h)).toBe(null);
  });
});

describe('chooseOutputMime', () => {
  it('JPEG stays JPEG; PNG/WebP become WebP when supported, else JPEG', () => {
    expect(chooseOutputMime('image/jpeg', true)).toBe('image/jpeg');
    expect(chooseOutputMime('image/png', true)).toBe('image/webp');
    expect(chooseOutputMime('image/webp', false)).toBe('image/jpeg');
  });
});

describe('precheckSource', () => {
  const head = new Uint8Array(JPEG);
  it('accepts a declared+sniffed raster image', () => {
    expect(precheckSource({ type: 'image/jpeg', size: 1000 }, head)).toBe('image/jpeg');
    expect(precheckSource({ type: 'IMAGE/PNG', size: 1000 }, new Uint8Array(PNG))).toBe('image/png');
  });
  it('refuses other declared types, SVG content, empty and > 12 MB sources', () => {
    expect(() => precheckSource({ type: 'image/svg+xml', size: 10 }, head)).toThrow(expect.objectContaining({ code: 'unsupported_type' }));
    expect(() => precheckSource({ type: 'image/gif', size: 10 }, head)).toThrow(expect.objectContaining({ code: 'unsupported_type' }));
    expect(() => precheckSource({ type: 'image/png', size: 10 }, new TextEncoder().encode('<svg></svg>'))).toThrow(expect.objectContaining({ code: 'unsupported_type' }));
    expect(() => precheckSource({ type: 'image/jpeg', size: 0 }, head)).toThrow(expect.objectContaining({ code: 'empty_file' }));
    expect(() => precheckSource({ type: 'image/jpeg', size: MAX_SOURCE_BYTES + 1 }, head)).toThrow(expect.objectContaining({ code: 'file_too_large' }));
    expect(precheckSource({ type: 'image/jpeg', size: MAX_SOURCE_BYTES }, head)).toBe('image/jpeg');
  });
});

describe('normalizeImage (pre-decode refusals; canvas paths are browser-only)', () => {
  it('rejects an SVG disguised as PNG before decoding', async () => {
    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>'], 'a.png', { type: 'image/png' });
    await expect(normalizeImage(file)).rejects.toMatchObject({ code: 'unsupported_type' });
  });
  it('rejects a missing file', async () => {
    await expect(normalizeImage(null)).rejects.toMatchObject({ code: 'empty_file' });
  });
});
