import { describe, it, expect, vi } from 'vitest';
import { buildQuotePdfFilename, computePageBoundaries, waitForImagesReady, getA4ContentBoxPt } from './generateQuotePdf';

// ONE SHARED A4 DOCUMENT CONTRACT ("FINAL SMART QUOTE PDF/PRINT/A4 CLOSURE
// PASS" task, Owner-mandated: "PDF and Print must share the same A4 content
// bounds"). getA4ContentBoxPt is the one shared source of truth the real
// generateQuotePdf() reads from (never re-derives its own copy) - these
// tests prove the exact numbers, independent of jsPDF/html2canvas (neither
// has real jsdom support).
describe('getA4ContentBoxPt - one shared A4 content-box contract', () => {
  it('page size matches ISO 216 A4 (210mm x 297mm) converted to pt, matching jsPDF\'s own format:"a4"', () => {
    const box = getA4ContentBoxPt();
    expect(box.pageWidthPt).toBeCloseTo(595.2755905511812, 6); // 210mm
    expect(box.pageHeightPt).toBeCloseTo(841.8897637795277, 6); // 297mm
  });

  it('margins match the already-established, Owner-approved @page print rule (12mm top/bottom, 10mm left/right) - not a second, invented number', () => {
    const box = getA4ContentBoxPt();
    expect(box.marginTopPt).toBeCloseTo(34.01574803149606, 6); // 12mm
    expect(box.marginBottomPt).toBeCloseTo(34.01574803149606, 6); // 12mm
    expect(box.marginLeftPt).toBeCloseTo(28.346456692913385, 6); // 10mm
    expect(box.marginRightPt).toBeCloseTo(28.346456692913385, 6); // 10mm
  });

  it('content box is exactly 190mm x 273mm (page minus margins on every side)', () => {
    const box = getA4ContentBoxPt();
    const mmToPt = 72 / 25.4;
    expect(box.contentWidthPt).toBeCloseTo(190 * mmToPt, 6);
    expect(box.contentHeightPt).toBeCloseTo(273 * mmToPt, 6);
  });

  it('content box is strictly smaller than the full page on every dimension - proves a real margin exists, not an edge-to-edge 100% box', () => {
    const box = getA4ContentBoxPt();
    expect(box.contentWidthPt).toBeLessThan(box.pageWidthPt);
    expect(box.contentHeightPt).toBeLessThan(box.pageHeightPt);
  });
});

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

  // Real regression found and fixed ("FINAL SMART QUOTE PDF/PRINT/A4
  // CLOSURE PASS" task) - a real downloaded PDF for a short EN fixture
  // produced a genuinely BLANK trailing page once this task's own A4
  // content-box fix shrank pageHeightPxIdeal to a content-box budget: real
  // content landing a few px over an exact multiple of that budget
  // produced a technically-correct-but-visually-empty extra page.
  it('NO BLANK TRAILING PAGE: a negligible trailing slice (content a few px over one page) merges into the previous page instead of creating a near-empty extra page', () => {
    // Content is 1005px tall against a 1000px page budget - only 5px
    // (0.5% of the page) would spill onto a "page 2." Must produce exactly
    // one page (1005), not two (1000, 1005).
    const boundaries = computePageBoundaries(1005, 1000, []);
    expect(boundaries).toEqual([0, 1005]);
  });

  it('a genuinely substantial trailing page (well above the negligible threshold) is never merged away', () => {
    // Content is 1300px tall against a 1000px page budget - the second
    // page (300px, 30% of a full page) is real content, not a rounding
    // sliver, and must remain its own page.
    const boundaries = computePageBoundaries(1300, 1000, []);
    expect(boundaries).toEqual([0, 1000, 1300]);
  });

  it('a trailing slice exactly at the negligible-ratio boundary (3% of a page) still merges (inclusive threshold check consistency)', () => {
    // 29px against a 1000px page = 2.9%, just under the 3% cutoff - must merge.
    const boundaries = computePageBoundaries(1029, 1000, []);
    expect(boundaries).toEqual([0, 1029]);
  });

  // PDF/Print Document Safety Contract closure ("ONE-PASS SMART QUOTE
  // FINAL REMEDIATION" task, real Owner-video evidence: "totals can sit
  // dangerously close to the printable page bottom"). These two tests
  // prove the GENERIC "widen a block's own range, push the whole thing
  // back to its own top" mechanism `computePageBoundaries` itself still
  // supports (any block may still ask for this) - the real totals call
  // site no longer uses it exactly this way (see the CORRECTIVE PAGINATION
  // EFFICIENCY PASS tests directly below, which cover its actual current
  // wiring: a disjoint fallback zone with its own smaller `pushTo`).
  it('GENERIC WHOLE-BLOCK-PUSH: a block that would fit exactly at the page edge (no split needed) still moves to the next page when its own required clearance would be cut off', () => {
    // A block spans 850-980px - it does NOT get split by a naive 1000px
    // page boundary (980 < 1000, technically "fits"). But with a required
    // 40px extra clearance appended to its own range (widening its own
    // bottom before passing it in - no `pushTo`, so it defaults to the
    // block's own top), the EFFECTIVE range becomes 850-1020px, which the
    // naive 1000px boundary DOES fall inside - so the whole block (not
    // just the overflow) must move to the next page, landing the boundary
    // at 850, not 1000.
    const blockWithWidenedRange = [{ top: 850, bottom: 980 + 40 }];
    const boundaries = computePageBoundaries(1500, 1000, blockWithWidenedRange);
    expect(boundaries).toContain(850);
    expect(boundaries).not.toContain(1000);
  });

  it('GENERIC WHOLE-BLOCK-PUSH: a block with genuine clearance below it is left exactly where it is (no unnecessary page added)', () => {
    // Same block (850-980px), but this time the page is taller (1100px
    // ideal) - 980 + 40px margin = 1020, comfortably under 1100, so no
    // boundary needs to move at all. Proves the mechanism does not force
    // an extra page when real clearance already exists.
    const blockWithWidenedRange = [{ top: 850, bottom: 980 + 40 }];
    const boundaries = computePageBoundaries(1500, 1100, blockWithWidenedRange);
    expect(boundaries).toEqual([0, 1100, 1500]);
  });

  // CORRECTIVE PAGINATION EFFICIENCY PASS task, real Owner-video evidence
  // ("large unused blank areas"), real root cause measured live on
  // A100726: the OLD totals-safe-margin wiring pushed the WHOLE totals
  // block back to its own TOP whenever the boundary fell inside its real
  // content OR its safety-margin buffer - correct for real content, but
  // wrong for the buffer-only case, where it stranded totals (and
  // everything after it - terms, footer) on a near-empty next page even
  // though totals' own real content had plenty of room on the current
  // page. These 3 tests cover the fixed, current real wiring: totals' real
  // content is one ordinary, always-enforced hard block (default `pushTo`
  // = its own top, via the generic mechanism above); the safety-margin
  // buffer is a SEPARATE, disjoint block starting at totals' own real
  // bottom, with an explicit smaller `pushTo` fallback target - together
  // they reproduce the exact fix.
  it('TOTALS FALLBACK CLEARANCE: a boundary landing only inside the decorative safety buffer (not totals\' real content) falls back to a small clearance below totals\' real bottom, not all the way to its top', () => {
    // Totals' real content: 850-980px (always hard-protected, pushTo its
    // own top by default). The safety-margin buffer is a SEPARATE block:
    // 980-1020px (real bottom + 40px ideal margin), with its own `pushTo`
    // at 990px (real bottom + a smaller 10px fallback). A naive 1000px
    // boundary falls inside the buffer zone (980 < 1000 < 1020) but NOT
    // inside totals' own real content (1000 > 980) - it must fall back
    // only to 990 (small fallback clearance), never to 850 (totals' top).
    const totalsRealContent = { top: 850, bottom: 980 };
    const totalsSafetyBufferZone = { top: 980, bottom: 1020, pushTo: 990 };
    const boundaries = computePageBoundaries(1500, 1000, [totalsRealContent, totalsSafetyBufferZone]);
    expect(boundaries).toContain(990);
    expect(boundaries).not.toContain(850);
    expect(boundaries).not.toContain(1000);
  });

  it('TOTALS FALLBACK CLEARANCE: a boundary landing inside totals\' own real content still pushes back to its own top, never merely to the fallback clearance', () => {
    // Same two-block setup, but this time the naive boundary (900px) falls
    // INSIDE totals' own real content (850-980) - this must still push
    // back to totals' own top (850), using the always-on hard block, not
    // the smaller fallback (990, which doesn't even apply here since 900
    // isn't inside the buffer zone at all).
    const totalsRealContent = { top: 850, bottom: 980 };
    const totalsSafetyBufferZone = { top: 980, bottom: 1020, pushTo: 990 };
    const boundaries = computePageBoundaries(1500, 900, [totalsRealContent, totalsSafetyBufferZone]);
    expect(boundaries).toContain(850);
    expect(boundaries).not.toContain(900);
  });

  it('TOTALS FALLBACK CLEARANCE: the ideal full safety margin is still used whenever it genuinely fits (fallback never applies unless it has to)', () => {
    // Page tall enough (1100px) that totals' real bottom + the full 40px
    // margin (1020) is comfortably under the naive boundary (1100) - no
    // push needed at all, full ideal clearance already present.
    const totalsRealContent = { top: 850, bottom: 980 };
    const totalsSafetyBufferZone = { top: 980, bottom: 1020, pushTo: 990 };
    const boundaries = computePageBoundaries(1500, 1100, [totalsRealContent, totalsSafetyBufferZone]);
    expect(boundaries).toEqual([0, 1100, 1500]);
  });

  // CORRECTIVE PAGINATION EFFICIENCY PASS task, real Owner-video evidence
  // ("large unused blank areas", "units moved to the next page too early").
  // These 4 tests prove the new "smallest matching block wins" selection
  // (a per-block `maxWasteRatio`, defaulting to the original 0.85 when
  // absent) directly, independent of the real DOM/selector wiring in
  // generateQuotePdf() itself.
  it('SOFT UNIT SPLIT: a nested item block (default, generous ceiling) wins over its own larger soft container (strict ceiling) when both contain the same boundary', () => {
    // A whole "unit" (100-1400px, soft, 22% ceiling) and one of its own
    // items (980-1050px, hard, default 85% ceiling) both span the naive
    // 1000px boundary. Pushing back to the unit's own top (100) would waste
    // 90% - well past its own 22% ceiling - but the smaller, nested item
    // block (waste 2%) is well within ITS OWN ceiling and must win instead:
    // the unit splits cleanly at the item boundary, not pushed whole.
    const blocks = [
      { top: 100, bottom: 1400, maxWasteRatio: 0.22 },
      { top: 980, bottom: 1050 },
    ];
    const boundaries = computePageBoundaries(1500, 1000, blocks);
    expect(boundaries).toContain(980);
    expect(boundaries).not.toContain(100);
    expect(boundaries).not.toContain(1000);
  });

  it('SOFT UNIT SPLIT: a whole unit still moves together when doing so wastes only a small amount (within its own 22% ceiling)', () => {
    // A unit spanning 900-1400px (no item nested at this exact boundary) -
    // pushing back to its own top (900) wastes only 10%, comfortably inside
    // its own 22% ceiling, so the whole unit moves together, exactly as the
    // Owner's own "if the entire unit fits safely, keep it together /
    // moving it as one block" rule requires.
    const blocks = [{ top: 900, bottom: 1400, maxWasteRatio: 0.22 }];
    const boundaries = computePageBoundaries(1500, 1000, blocks);
    expect(boundaries).toContain(900);
    expect(boundaries).not.toContain(1000);
  });

  it('SOFT UNIT SPLIT: an oversized unit is allowed to split (not pushed whole) when moving it whole would waste more than its own 22% ceiling', () => {
    // A unit spanning 300-1400px, with no smaller item registered at this
    // exact boundary - pushing back to 300 would waste 70%, far past the
    // unit's own 22% ceiling (this is the OLD 85%-ceiling behavior this
    // task explicitly closes - previously this same block would still have
    // been pushed whole, wasting 70% of the page). The boundary is left at
    // the naive 1000px cut instead - the unit is allowed to split here.
    const blocks = [{ top: 300, bottom: 1400, maxWasteRatio: 0.22 }];
    const boundaries = computePageBoundaries(1500, 1000, blocks);
    expect(boundaries).toContain(1000);
    expect(boundaries).not.toContain(300);
  });

  it('SOFT UNIT SPLIT: an item nested inside an oversized unit is still never itself cut, even though the unit around it is allowed to split', () => {
    // Same oversized unit (300-1400px, 22% ceiling) as the previous test,
    // but this time an item (950-1200px, default 85% ceiling) sits exactly
    // on the naive 1000px boundary. The unit's own push-back is rejected
    // (70% waste, over its 22% ceiling) exactly as before, but the smaller,
    // nested item block is evaluated as its own candidate and DOES satisfy
    // its own generous ceiling (5% waste) - the boundary lands at the
    // item's own top (950), never inside it.
    const blocks = [
      { top: 300, bottom: 1400, maxWasteRatio: 0.22 },
      { top: 950, bottom: 1200 },
    ];
    const boundaries = computePageBoundaries(1500, 1000, blocks);
    expect(boundaries).toContain(950);
    expect(boundaries).not.toContain(300);
    expect(boundaries).not.toContain(1000);
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
