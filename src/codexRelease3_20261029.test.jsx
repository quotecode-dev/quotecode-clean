// Codex release 3 (Owner 2026-10-29, typed: "מאשר שחרור 3 של קודקס: נגישות המספרים, פיצול הקוד ותמונת הפתיחה, כולל שינוי ב-L-02, L-15,
// בלי שינוי באנימציה ובמראה"); docs/CODEX_SPEC_MORNING_PLANS_2026-10-29.md section 3.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { lazy } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import RouteChunkBoundary from './shared/RouteChunkBoundary';
import { composeRouteHtml } from '../scripts/publicRouteHtml.mjs';

afterEach(cleanup);
const src = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

describe('step 1: the sample numbers are announced, the look is unchanged', () => {
  it('one screen-reader-only full value per number; no aria-label on a plain span; the visual fragments stay hidden', () => {
    const s = src('src/components/landing/LandingQuoteDocument.jsx');
    const fn = s.slice(s.indexOf('function AlignedNumber'), s.indexOf('function HeaderCall'));
    expect(fn).not.toContain('aria-label={');
    expect(fn).toContain('<span className="sr-only">{text}</span>');
    expect(fn.match(/aria-hidden="true"/g)).toHaveLength(2);
    expect(fn).toContain('className="tl-num-value"');
  });
});

describe('step 2: the landing downloads only itself', () => {
  it('the entry imports only the selected market shell, and mounts it once its code is ready (the prerendered page stays meanwhile)', () => {
    const m = src('src/main.jsx');
    expect(m).not.toMatch(/^import App(Local|Global) /m);
    expect(m).toContain("const loadShell = isEnglishEnv ? () => import('./global/AppGlobal.jsx') : () => import('./local/AppLocal.jsx')");
    expect(m.indexOf('loadShell().then(')).toBeLessThan(m.indexOf("createRoot(document.getElementById('root'))"));
  });
  it.each(['src/local/AppLocal.jsx', 'src/global/AppGlobal.jsx'])('%s loads the heavy screens on demand, the landing stays in the shell', (file) => {
    const s = src(file);
    for (const page of ['Dashboard', 'AILogs', 'SmartPublicQuote', 'PublicBusinessCard', 'SampleQuote']) {
      expect(s).toMatch(new RegExp(`const ${page} = lazy\\(\\(\\) => import\\('\\.\\./(pages|components)/${page}'\\)\\);`));
      expect(s).not.toMatch(new RegExp(`^import ${page} from`, 'm'));
    }
    expect(s).toMatch(/^import Landing(Local|Global) from '\.\.\/pages\/Landing(Local|Global)';$/m);
    expect(s).toContain('<RouteChunkBoundary isHebrew=');
  });
  it('while a screen loads: one quiet localized line (HE / EN)', () => {
    const Never = lazy(() => new Promise(() => {}));
    render(<RouteChunkBoundary isHebrew><Never /></RouteChunkBoundary>);
    expect(screen.getByTestId('route-chunk-loading').textContent).toBe('העמוד נטען…');
    cleanup();
    render(<RouteChunkBoundary isHebrew={false}><Never /></RouteChunkBoundary>);
    expect(screen.getByTestId('route-chunk-loading').textContent).toBe('Loading page…');
  });
  it('a screen whose file cannot be loaded: a clear message and a retry (HE / EN)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Broken = lazy(() => Promise.reject(new Error('Failed to fetch dynamically imported module')));
    render(<RouteChunkBoundary isHebrew><Broken /></RouteChunkBoundary>);
    const box = await screen.findByTestId('route-chunk-failed');
    expect(box.textContent).toBe('לא הצלחנו לטעון את העמוד. אפשר לנסות שוב.ניסיון נוסף');
    cleanup();
    render(<RouteChunkBoundary isHebrew={false}><Broken /></RouteChunkBoundary>);
    expect((await screen.findByTestId('route-chunk-failed')).textContent).toBe('We couldn’t load this page. Please try again.Try again');
    spy.mockRestore();
  });
});

describe('step 3: the hero images are discovered from the first HTML, the look is unchanged', () => {
  const shell = src('index.html').replace(/<div id="root">[\s\S]*?<\/div>/, '<div id="root"></div>');
  const route = (path, lang) => ({ path, lang, title: 't', description: 'd', hreflang: [] });
  it('a landing page preloads its workshop photo (first) and only its own language phone', () => {
    const he = composeRouteHtml(shell, route('/he', 'he'), '<main>x</main>');
    expect(he).toContain('<link rel="preload" as="image" href="/assets/landing/hero-workshop.webp" type="image/webp" fetchpriority="high" />');
    expect(he).toContain('<link rel="preload" as="image" href="/assets/landing/hero-phone-he.webp" type="image/webp" />');
    expect(he).not.toContain('hero-phone-en.webp');
    const en = composeRouteHtml(shell, route('/en', 'en'), '<main>x</main>');
    expect(en).toContain('hero-phone-en.webp');
    expect(en).not.toContain('hero-phone-he.webp');
    expect(composeRouteHtml(shell, route('/he/tools', 'he'), '<main>x</main>')).not.toContain('rel="preload" as="image"');
  });
  it('the hero images carry the real dimensions of the approved originals (the CSS still sizes them)', () => {
    const s = src('src/components/landing/LandingPage.jsx');
    expect(s).toContain('<img src="/assets/landing/hero-workshop.webp" alt="" width="1600" height="666" fetchpriority="high" decoding="async" />');
    expect(s).toContain('width={isHe ? 809 : 920}');
    expect(s).toContain('height={isHe ? 1419 : 1296}');
  });
});
