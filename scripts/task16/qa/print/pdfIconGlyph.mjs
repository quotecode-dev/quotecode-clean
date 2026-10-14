// Task 16 cloud-fix4b (A18, A17 H2): the ONE svg text node that long-amounts.mjs min-font-12 may exclude - the "PDF" glyph
// drawn inside the PDF tile icon (src/components/PdfFileIcon.jsx). Identified by its exact structure, not by "any text
// inside any svg": <svg viewBox="0 0 24 24"> whose children are exactly path, path, text; the two paths are the lucide
// File / FileText outline (d values below); the text is "PDF" at x 12, y 17.5, font-size 6.2, text-anchor middle; the
// rendered icon box is icon-sized (<= 48px, the touch-target bound used by the dark-pocket rule). Every other svg text is
// judged by its RENDERED size (font-size x the svg's screen scale) like any other text.
// DOM-only and self-contained: long-amounts.mjs installs it in the page by its source (isPdfIconGlyph.toString()).
export function isPdfIconGlyph(e) {
  const PATHS = ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6'];
  const ICON_MAX_PX = 48;
  if (!e || String(e.tagName).toLowerCase() !== 'text') return false;
  if ((e.textContent || '').trim() !== 'PDF') return false;
  const svg = e.parentElement;
  if (!svg || String(svg.tagName).toLowerCase() !== 'svg') return false;
  if ((svg.getAttribute('viewBox') || '').trim().replace(/\s+/g, ' ') !== '0 0 24 24') return false;
  const kids = [...svg.children];
  if (kids.map((k) => String(k.tagName).toLowerCase()).join(',') !== 'path,path,text' || kids[2] !== e) return false;
  if (kids.slice(0, 2).some((k, i) => (k.getAttribute('d') || '').replace(/\s+/g, ' ').trim() !== PATHS[i])) return false;
  const a = (n) => (e.getAttribute(n) || '').trim();
  if (a('x') !== '12' || a('y') !== '17.5' || a('font-size') !== '6.2' || a('text-anchor') !== 'middle') return false;
  const r = svg.getBoundingClientRect ? svg.getBoundingClientRect() : { width: 0, height: 0 };
  return r.width <= ICON_MAX_PX && r.height <= ICON_MAX_PX;
}

// Rendered font size of a text-bearing element: an svg <text> is scaled by its svg's screen transform.
export function renderedFontPx(e, cssFontPx) {
  if (!e.closest || !e.closest('svg') || typeof e.getScreenCTM !== 'function') return cssFontPx;
  const m = e.getScreenCTM();
  return m ? +(cssFontPx * Math.hypot(m.a, m.b)).toFixed(2) : cssFontPx;
}
