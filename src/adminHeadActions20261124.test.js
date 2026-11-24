// Owner console 2026-11-24, typed: "מאשר שינוי ב-L-21: שורת הזמן וכפתור הרענון בראש מסכי הניהול בשורה אחת וצמודים לקצה גם באנגלית, בתוך
// השחרור הזה" - the law-49 check of the social media screen found the English head actions (data time + refresh) squeezed into two rows,
// away from the end edge, while the Hebrew ones sat in one row at the edge. From 1024px up the actions never shrink or wrap; the phone /
// portrait-tablet rules stay as they were.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./components/adminV2.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const block = (query) => { const i = css.indexOf(`@media (${query}) {`); if (i < 0) return ''; let depth = 0; for (let j = css.indexOf('{', i); j < css.length; j += 1) { if (css[j] === '{') depth += 1; if (css[j] === '}') { depth -= 1; if (depth === 0) return css.slice(i, j + 1); } } return ''; };

describe('admin head actions (Owner 2026-11-24, L-21)', () => {
  it('from 1024px the data time and the refresh button keep one row at the edge', () => {
    const wide = block('min-width: 1024px');
    expect(wide).toMatch(/\.av-headactions\s*\{\s*flex:\s*none;\s*flex-wrap:\s*nowrap;\s*\}/);
    expect(wide).toMatch(/\.av \.av-updated\s*\{\s*white-space:\s*nowrap;\s*\}/);
  });
  it('the base and phone rules are unchanged', () => {
    expect(css).toContain('.av-headactions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }');
    expect(css).toContain('.av .av-pagehead { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-block-end: 14px; flex-wrap: nowrap; }');
    expect(block('max-width: 599px')).toContain('.av .admin-screen-heading > p, .av .av-updated { display: none; }');
  });
});
