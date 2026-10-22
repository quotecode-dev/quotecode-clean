// Owner 2026-10-23 ("בכלים, עדיף להוריד את האייקונים ולהשאיר בלי, זה נראה ממש לא מקצועי"; law 45): the public tools never show emoji
// pictures (the metal list had medals and coin glyphs that some systems draw as empty boxes) - plain words only.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('public tools: no emoji icons', () => {
  it.each(['src/components/PublicTools.jsx', 'src/components/PublicToolsEn.jsx'])('%s', (f) => {
    expect(readFileSync(f, 'utf8')).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
