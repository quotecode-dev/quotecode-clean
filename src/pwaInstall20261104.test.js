// Home-screen install (Owner console 2026-11-04, PROFLOW_TODO 5a, typed: "מאשר את שניהם"): one manifest per language, opening the
// dashboard in that language in standalone mode; white icons without the stray top line; no service worker.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const read = (p) => readFileSync(join(cwd(), p));
const pngSize = (p) => { const b = read(`public${p}`); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const html = read('index.html').toString('utf8');
const main = read('src/main.jsx').toString('utf8');

describe('install to the home screen', () => {
  for (const [lang, dir] of [['he', 'rtl'], ['en', 'ltr']]) {
    it(`${lang} manifest opens the ${lang} dashboard full screen with the TEKANGO icons`, () => {
      const m = JSON.parse(read(`public/manifest-${lang}.webmanifest`).toString('utf8'));
      expect(m).toMatchObject({ name: 'TEKANGO', short_name: 'TEKANGO', lang, dir, start_url: `/dashboard?lang=${lang}`, id: `/dashboard?lang=${lang}`, scope: '/', display: 'standalone' });
      expect(m.icons.map((i) => `${i.sizes} ${i.purpose}`)).toEqual(['192x192 any', '512x512 any', '512x512 maskable']);
      for (const i of m.icons) expect(pngSize(i.src).join('x')).toBe(i.sizes);
    });
  }

  it('the page links the manifest and the iPhone icon, and main.jsx picks the manifest of its language', () => {
    expect(html).toContain('<link rel="manifest" href="/manifest-he.webmanifest" />');
    expect(html).toContain('<link rel="apple-touch-icon" sizes="180x180" href="/tekango-apple-touch-icon-180.png" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="TEKANGO" />');
    expect(pngSize('/tekango-apple-touch-icon-180.png')).toEqual([180, 180]);
    expect(main).toContain("isEnglishEnv ? '/manifest-en.webmanifest' : '/manifest-he.webmanifest'");
  });

  it('registers no service worker (nothing is cached, the new-version notice keeps working)', () => {
    expect(main).not.toMatch(/serviceWorker/);
    expect(existsSync(join(cwd(), 'public/sw.js'))).toBe(false);
  });
});
