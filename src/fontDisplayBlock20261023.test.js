// Iron Law 46 (IRON-FONT-001, Owner console 2026-10-23): "... ובטעינה הטקסט מחכה לרוביק במקום להציג גופן אחר". The Owner saw the
// whole landing page flash in the fallback font on refresh: the @fontsource CSS declares font-display: swap. src/fonts.css carries the
// SAME @font-face rules as the installed packages (family, weight, files, ranges, order) with font-display: block - nothing else.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const fonts = readFileSync('src/fonts.css', 'utf8').replace(/\r\n/g, '\n');
const SPECS = [
  ...['400', '500', '600', '700', '800', '900'].flatMap((w) => [`@fontsource/rubik/latin-${w}.css`, `@fontsource/rubik/hebrew-${w}.css`]),
  '@fontsource-variable/rubik/wght.css',
];
const faces = (css) => css.match(/@font-face\s*\{[^}]*\}/g) || [];

describe('Rubik loads with font-display: block (Iron Law 46)', () => {
  it('no @fontsource import is left (an import would bring back font-display: swap); every face waits for Rubik', () => {
    expect(fonts).not.toMatch(/@import\s+['"]@fontsource/);
    const own = faces(fonts);
    expect(own).toHaveLength(18);
    for (const f of own) {
      expect(f).toMatch(/font-display: block;/);
      expect(f).not.toMatch(/swap|optional|fallback/);
    }
  });
  it('the faces are exactly the installed packages\' faces, in the same order - only the display changed', () => {
    const expected = SPECS.flatMap((spec) => {
      const dir = spec.split('/').slice(0, 2).join('/');
      return faces(readFileSync(`node_modules/${spec}`, 'utf8').replace(/\r\n/g, '\n'))
        .map((f) => f.replace('font-display: swap;', 'font-display: block;').replace(/url\(\.\/files\//g, `url(../node_modules/${dir}/files/`));
    });
    expect(faces(fonts)).toEqual(expected);
  });
  it('the root cause (2): every page asks for the Rubik files at its top (the build preloads the hashed woff2 assets)', () => {
    const cfg = readFileSync('vite.config.js', 'utf8');
    expect(cfg).toContain('plugins: [react(), rubikPreloadPlugin(),');
    expect(cfg).toContain("rel: 'preload', as: 'font', type: 'font/woff2'");
    for (const face of ['hebrew-400', 'hebrew-700', 'latin-400']) expect(cfg).toContain("'" + face + "'");
  });
  it('fonts.css is still loaded from main.jsx, outside the Tailwind pipeline', () => {
    expect(readFileSync('src/main.jsx', 'utf8')).toMatch(/import '\.\/fonts\.css'/);
  });
});
