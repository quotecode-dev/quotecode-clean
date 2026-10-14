// @vitest-environment jsdom
// Task 16 cloud-fix4b (A18, A17 H2): only the "PDF" glyph of the exact PdfFileIcon is excluded from min-font-12.
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PdfFileIcon from '../../../../src/components/PdfFileIcon.jsx';
import { isPdfIconGlyph } from './pdfIconGlyph.mjs';

const mount = (html) => { const d = document.createElement('div'); d.innerHTML = html; document.body.appendChild(d); return d; };
const textOf = (root) => root.querySelector('text');

describe('isPdfIconGlyph', () => {
  it('POSITIVE: the real PdfFileIcon markup (sizes 18 / 24) is identified', () => {
    for (const size of [18, 24]) expect(isPdfIconGlyph(textOf(mount(renderToStaticMarkup(React.createElement(PdfFileIcon, { size }))))), `size ${size}`).toBe(true);
  });
  const real = renderToStaticMarkup(React.createElement(PdfFileIcon, {}));
  it('NEGATIVE: an svg label with 11px text is NOT excluded', () => {
    expect(isPdfIconGlyph(textOf(mount('<svg width="120" height="16" viewBox="0 0 120 16"><text x="0" y="12" font-size="11">Synthetic badge</text></svg>')))).toBe(false);
  });
  it('NEGATIVE: "PDF" text in another svg (different viewBox / structure / attributes) is NOT excluded', () => {
    expect(isPdfIconGlyph(textOf(mount('<svg width="40" height="16" viewBox="0 0 40 16"><text x="0" y="12" font-size="11">PDF</text></svg>')))).toBe(false);
    expect(isPdfIconGlyph(textOf(mount(real.replace('viewBox="0 0 24 24"', 'viewBox="0 0 48 24"'))))).toBe(false);
    expect(isPdfIconGlyph(textOf(mount(real.replace('font-size="6.2"', 'font-size="11"'))))).toBe(false);
    expect(isPdfIconGlyph(textOf(mount(real.replace('<path d="M14 2v6h6"></path>', '<path d="M14 2v6h6"></path><circle r="1"></circle>'))))).toBe(false);
    expect(isPdfIconGlyph(textOf(mount(real.replace('>PDF<', '>ZIP<'))))).toBe(false);
  });
  it('NEGATIVE: non-text elements are never the glyph', () => {
    expect(isPdfIconGlyph(mount(real).querySelector('svg'))).toBe(false);
    expect(isPdfIconGlyph(null)).toBe(false);
  });
});
