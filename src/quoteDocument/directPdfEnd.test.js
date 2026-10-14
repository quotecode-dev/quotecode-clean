import { describe, it, expect } from 'vitest';
import { computeDocumentBoundaries, computePageBoundaries, endIsOrphaned } from '../utils/generateQuotePdf';

// cloud-fix3 (A6): the Direct PDF never leaves the approval / footer alone on its last page, and a document that already
// fits (incl. the negligible-trailing-slice merge) keeps its slicing.
describe('Direct PDF - end of document kept with body content', () => {
  const PAGE = 1000;
  it('a document that fits one page (or merges a < 3% trailing slice) is unchanged', () => {
    const end = { top: 700, bodyBottom: 880, bottom: 1020 };
    expect(computeDocumentBoundaries(1020, PAGE, [], end)).toEqual(computePageBoundaries(1020, PAGE, []));
    expect(computeDocumentBoundaries(1020, PAGE, [], end)).toEqual([0, 1020]);
  });
  it('approval + footer that would start the last page alone move there WITH the last body block', () => {
    const notes = { top: 760, bottom: 950 };
    const approval = { top: 952, bottom: 1010 };
    const end = { top: notes.top, bodyBottom: notes.bottom, bottom: 1060 };
    const plain = computePageBoundaries(1060, PAGE, [notes, approval]);
    expect(endIsOrphaned(plain, end)).toBe(true); // plain slicing: page 2 = approval + footer only
    const b = computeDocumentBoundaries(1060, PAGE, [notes, approval], end);
    expect(b).toEqual([0, 760, 1060]);
    expect(endIsOrphaned(b, end)).toBe(false);
  });
  it('a group taller than the push-back ceiling keeps the plain slicing (never cuts content to save the footer)', () => {
    const end = { top: 50, bodyBottom: 990, bottom: 1060 };
    expect(computeDocumentBoundaries(1060, PAGE, [{ top: 995, bottom: 1010 }], end)).toEqual(computePageBoundaries(1060, PAGE, [{ top: 995, bottom: 1010 }]));
  });
  it('no end measured => plain slicing', () => {
    expect(computeDocumentBoundaries(2500, PAGE, [], null)).toEqual(computePageBoundaries(2500, PAGE, []));
  });
});
