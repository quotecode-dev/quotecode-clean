// IRON-PRINT-001 (page breaks / clipping) - how the candidate's Direct PDF ENDS a document. The real pagination
// (computePageBoundaries) and the real orchestration (generateQuotePdf); only the rasterizer (html2canvas), the PDF
// writer (jsPDF) and the 2D canvas context are isolated - none has jsdom support. Complements
// src/utils/generateQuotePdf.test.js (block pushes, totals clearance, the 3% threshold itself) with end-of-document
// guarantees: nothing at the end is lost, duplicated, left on a near-empty page, or drawn off the sheet.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computePageBoundaries, generateQuotePdf, getA4ContentBoxPt } from '../utils/generateQuotePdf';

const pdf = { pages: 1, images: [] };
vi.mock('jspdf', () => ({ jsPDF: class { addPage() { pdf.pages += 1; } addImage(...a) { pdf.images.push(a); } save() {} } }));
const html2canvasMock = vi.fn();
vi.mock('html2canvas', () => ({ default: (...a) => html2canvasMock(...a) }));

const box = getA4ContentBoxPt();
const A4_HEIGHT_PT = (297 / 25.4) * 72;
const WIDTH = 1000;
const pxPerPt = WIDTH / box.contentWidthPt;
const PAGE_PX = box.contentHeightPt * pxPerPt;
const canvasOf = (h) => ({ width: WIDTH, height: h, toDataURL: () => 'data:image/jpeg;base64,AAAA' });

let drawn;
beforeEach(() => {
  pdf.pages = 1; pdf.images = []; drawn = []; html2canvasMock.mockReset();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect() {}, drawImage: (...a) => drawn.push(a), fillStyle: '' });
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,AAAA');
});
afterEach(() => vi.restoreAllMocks());

describe('Direct PDF - the end of the document', () => {
  it('for any height and block layout the pages start at 0, end exactly at the document end, never repeat, and only the LAST may exceed a page (by < 3%)', () => {
    const page = 1000;
    for (const h of [1, 999, 1000, 1001, 1029, 1030, 1031, 1500, 2000, 2029, 2600, 4970]) {
      for (const blocks of [[], [{ top: 950, bottom: 1080 }], [{ top: 990, bottom: 1010 }, { top: 1960, bottom: 2040 }], [{ top: 100, bottom: 1950 }]]) {
        const b = computePageBoundaries(h, page, blocks);
        const label = `${h} / ${JSON.stringify(blocks)}`;
        expect(b[0], label).toBe(0);
        expect(b[b.length - 1], label).toBe(h);
        for (let i = 1; i < b.length; i += 1) expect(b[i], label).toBeGreaterThan(b[i - 1]);
        for (let i = 1; i < b.length - 1; i += 1) expect(b[i] - b[i - 1], label).toBeLessThanOrEqual(page);
        expect(b[b.length - 1] - b[b.length - 2], label).toBeLessThan(page * 1.03 + 1e-9);
      }
    }
  });

  it('every row of the capture, including the last ones, is drawn exactly once: page slices are contiguous and cover the whole document', async () => {
    const H = Math.round(PAGE_PX * 2.4);
    html2canvasMock.mockResolvedValue(canvasOf(H));
    await generateQuotePdf({ captureEl: document.createElement('div'), filename: 'end.pdf' });
    const slices = drawn.map(([, , sy, , sh]) => [sy, sy + sh]);
    expect(slices[0][0]).toBe(0);
    for (let i = 1; i < slices.length; i += 1) expect(slices[i][0]).toBeCloseTo(slices[i - 1][1], 6);
    expect(slices[slices.length - 1][1]).toBe(H);
    expect(pdf.images).toHaveLength(slices.length);
    expect(pdf.pages).toBe(slices.length);
  });

  it('a few rows past one page never become a near-empty last page: they stay on the page before, and nothing is dropped', async () => {
    const H = Math.round(PAGE_PX * 1.02);
    html2canvasMock.mockResolvedValue(canvasOf(H));
    await generateQuotePdf({ captureEl: document.createElement('div'), filename: 'tail.pdf' });
    expect(pdf.pages).toBe(1);
    expect(drawn).toHaveLength(1);
    expect(drawn[0].slice(2, 5)).toEqual([0, WIDTH, H]);
  });

  it('that merged last page stays on the physical A4 sheet: it may use part of the bottom margin (< 3% of the content height), never more', async () => {
    const H = Math.floor(PAGE_PX * 2.029);
    html2canvasMock.mockResolvedValue(canvasOf(H));
    await generateQuotePdf({ captureEl: document.createElement('div'), filename: 'sheet.pdf' });
    expect(pdf.pages).toBe(2);
    const [, , , y, , h] = pdf.images[pdf.images.length - 1];
    expect(h).toBeGreaterThan(box.contentHeightPt);
    expect(h - box.contentHeightPt).toBeLessThan(box.contentHeightPt * 0.03);
    expect(y + h).toBeLessThanOrEqual(A4_HEIGHT_PT);
    for (const [, , , yy, , hh] of pdf.images.slice(0, -1)) expect(yy + hh).toBeLessThanOrEqual(box.marginTopPt + box.contentHeightPt + 0.01);
  });
});
