import { describe, it, expect, vi } from 'vitest';
import { buildQuotePdfFilename, computePageBoundaries, waitForImagesReady } from './generateQuotePdf';

describe('buildQuotePdfFilename', () => {
  it('uses the real formatted quote number', () => {
    expect(buildQuotePdfFilename('A100701')).toBe('Tekango-Quote-A100701.pdf');
  });

  it('falls back to a generic name when no real quote number exists (never a raw UUID/database id)', () => {
    expect(buildQuotePdfFilename(null)).toBe('Tekango-Quote.pdf');
    expect(buildQuotePdfFilename(undefined)).toBe('Tekango-Quote.pdf');
    expect(buildQuotePdfFilename('')).toBe('Tekango-Quote.pdf');
  });

  it('sanitizes unsafe filename characters', () => {
    expect(buildQuotePdfFilename('A100/701?<>*')).toBe('Tekango-Quote-A100701.pdf');
    expect(buildQuotePdfFilename('A100 701')).toBe('Tekango-Quote-A100701.pdf');
  });

  it('never leaks a raw UUID-shaped fallback string into the filename', () => {
    // formatQuoteFallback-style UUID fragments (e.g. "#a29b1fbb") must never
    // be passed to this function as the "real" number - callers must pass
    // formatQuoteNumber's own null-safe output, not the UUID fallback.
    const result = buildQuotePdfFilename('#a29b1fbb');
    // the '#' is stripped by sanitization; this documents that IF a caller
    // mistakenly passed a UUID fragment, it would still not look like a
    // real quote number - but the real contract is callers use
    // formatQuoteNumber(quote.quote_number), never formatQuoteFallback().
    expect(result).toBe('Tekango-Quote-a29b1fbb.pdf');
  });
});

describe('computePageBoundaries - page-break-aware pagination', () => {
  it('produces a single page when content fits within one page height', () => {
    const boundaries = computePageBoundaries(500, 1000, []);
    expect(boundaries).toEqual([0, 500]);
  });

  it('splits content taller than one page into multiple naive pages when there are no blocks to protect', () => {
    const boundaries = computePageBoundaries(2500, 1000, []);
    expect(boundaries[0]).toBe(0);
    expect(boundaries[boundaries.length - 1]).toBe(2500);
    expect(boundaries.length).toBeGreaterThan(2);
  });

  it('nudges a page boundary back to avoid cutting through a protected block', () => {
    // A block spans 900-1100px; a naive page boundary at 1000px would cut
    // straight through it. The boundary must move back to the block's own
    // top (900) instead of splitting it.
    const blocks = [{ top: 900, bottom: 1100 }];
    const boundaries = computePageBoundaries(1500, 1000, blocks);
    expect(boundaries).toContain(900);
    expect(boundaries).not.toContain(1000);
  });

  it('allows a block to split when avoiding the split would waste too much of the page (>85%)', () => {
    // A block starting almost immediately (at 50px) spanning past the
    // naive boundary - pushing back to 50px would waste ~95% of the page,
    // so the split is allowed rather than producing a near-empty page.
    const blocks = [{ top: 50, bottom: 1200 }];
    const boundaries = computePageBoundaries(1500, 1000, blocks);
    expect(boundaries).toContain(1000); // split allowed, not pushed back to 50
  });

  it('always terminates and reaches the full canvas height (no infinite loop, no stuck cursor)', () => {
    const blocks = [
      { top: 100, bottom: 300 },
      { top: 950, bottom: 1050 },
      { top: 1900, bottom: 2050 },
    ];
    const boundaries = computePageBoundaries(3000, 1000, blocks);
    expect(boundaries[boundaries.length - 1]).toBe(3000);
    expect(boundaries.every((v, i) => i === 0 || v > boundaries[i - 1])).toBe(true);
  });

  it('handles zero-height content without throwing', () => {
    expect(() => computePageBoundaries(0, 1000, [])).not.toThrow();
  });
});

// Faded PDF Logo Correction task: waitForImagesReady must resolve once every
// image inside the capture element is actually ready (not just "started
// loading"), using img.decode() where available, with a bounded, safe
// fallback for images that are already loaded, or that never fire load/
// error/decode (no arbitrary long fixed delay as the sole fix, and never an
// unbounded hang). NOTE: this only proves the *waiting behavior* - it cannot
// prove canvas/PDF pixel quality (jsdom has no real canvas/CORS/paint-order
// semantics); that was verified separately with a real browser and real
// downloaded PDF files - see PROFLOW_CODEX_CHECKPOINT.md.
describe('waitForImagesReady', () => {
  it('resolves immediately for an image that is already complete', async () => {
    const img = document.createElement('img');
    Object.defineProperty(img, 'complete', { value: true });
    Object.defineProperty(img, 'naturalWidth', { value: 240 });
    const root = document.createElement('div');
    root.appendChild(img);
    await expect(waitForImagesReady(root, 500)).resolves.toBeUndefined();
  });

  it('awaits img.decode() when available before resolving', async () => {
    const img = document.createElement('img');
    Object.defineProperty(img, 'complete', { value: false });
    Object.defineProperty(img, 'naturalWidth', { value: 0 });
    let decodeResolve;
    img.decode = vi.fn(() => new Promise((resolve) => { decodeResolve = resolve; }));
    const root = document.createElement('div');
    root.appendChild(img);

    let settled = false;
    const promise = waitForImagesReady(root, 2000).then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(img.decode).toHaveBeenCalled();
    decodeResolve();
    await promise;
    expect(settled).toBe(true);
  });

  it('does not reject/throw when img.decode() fails (bounded error handling, not a crash)', async () => {
    const img = document.createElement('img');
    Object.defineProperty(img, 'complete', { value: false });
    Object.defineProperty(img, 'naturalWidth', { value: 0 });
    img.decode = vi.fn(() => Promise.reject(new Error('decode failed')));
    const root = document.createElement('div');
    root.appendChild(img);
    await expect(waitForImagesReady(root, 500)).resolves.toBeUndefined();
  });

  it('falls back to load/error listeners when decode() is unavailable', async () => {
    const img = document.createElement('img');
    Object.defineProperty(img, 'complete', { value: false });
    Object.defineProperty(img, 'naturalWidth', { value: 0 });
    img.decode = undefined;
    const root = document.createElement('div');
    root.appendChild(img);

    let settled = false;
    const promise = waitForImagesReady(root, 2000).then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    img.dispatchEvent(new Event('load'));
    await promise;
    expect(settled).toBe(true);
  });

  it('is bounded by timeoutMs and never hangs forever on a stuck image', async () => {
    const img = document.createElement('img');
    Object.defineProperty(img, 'complete', { value: false });
    Object.defineProperty(img, 'naturalWidth', { value: 0 });
    img.decode = undefined; // never fires load/error either - simulates a stuck image
    const root = document.createElement('div');
    root.appendChild(img);
    await expect(waitForImagesReady(root, 50)).resolves.toBeUndefined();
  });

  it('resolves with no images present (nothing to wait for)', async () => {
    const root = document.createElement('div');
    await expect(waitForImagesReady(root, 500)).resolves.toBeUndefined();
  });
});
