// Codex release 3 (Owner 2026-10-29, typed: "מאשר שחרור 3 של קודקס: נגישות המספרים, פיצול הקוד ותמונת הפתיחה, כולל שינוי ב-L-02, L-15,
// בלי שינוי באנימציה ובמראה"); docs/CODEX_SPEC_MORNING_PLANS_2026-10-29.md section 3.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { lazy } from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import RouteChunkBoundary from './shared/RouteChunkBoundary';
import * as quoteDraft from './utils/quoteDraft';
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
    window.sessionStorage.setItem('tekango-chunk-reload-at', String(Date.now())); // the one automatic reload was already used
    render(<RouteChunkBoundary isHebrew><Broken /></RouteChunkBoundary>);
    const box = await screen.findByTestId('route-chunk-failed');
    expect(box.textContent).toBe('לא הצלחנו לטעון את העמוד. אפשר לנסות שוב.ניסיון נוסף');
    cleanup();
    render(<RouteChunkBoundary isHebrew={false}><Broken /></RouteChunkBoundary>);
    expect((await screen.findByTestId('route-chunk-failed')).textContent).toBe('We couldn’t load this page. Please try again.Try again');
    spy.mockRestore();
    window.sessionStorage.clear();
  });
  describe('Owner 2026-11-02 (typed: "מאשר תיקון שירה, מע"מ של עוסק פטור כולל שינוי ב-L-22, רענון אוטומטי פעם אחת במסך הטעינה כולל שינוי ב-L-02 ו-L-15, ותיקון 30527 בפיי פלוס, שחרור עד הלייב"): one automatic reload', () => {
    const real = window.location;
    let reload;
    let flush;
    let spy;
    beforeEach(() => {
      window.sessionStorage.clear();
      reload = vi.fn();
      flush = vi.spyOn(quoteDraft, 'flushAllDrafts');
      spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      Object.defineProperty(window, 'location', { configurable: true, value: { ...real, reload } });
    });
    afterEach(() => {
      Object.defineProperty(window, 'location', { configurable: true, value: real });
      flush.mockRestore(); spy.mockRestore(); vi.restoreAllMocks(); window.sessionStorage.clear();
    });
    const failing = (message) => { const B = lazy(() => Promise.reject(new Error(message))); return <RouteChunkBoundary isHebrew><B /></RouteChunkBoundary>; };
    it('a file that did not load: drafts first, then one reload; the second failure keeps the message', async () => {
      render(failing('Failed to fetch dynamically imported module'));
      await screen.findByTestId('route-chunk-failed');
      await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
      expect(flush.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0]);
      cleanup();
      render(failing('Importing a module script failed.'));
      await screen.findByTestId('route-chunk-failed');
      expect(reload).toHaveBeenCalledTimes(1);
    });
    it('any other crash of a screen, or a device offline: no reload', async () => {
      render(failing('Cannot read properties of undefined'));
      await screen.findByTestId('route-chunk-failed');
      expect(reload).not.toHaveBeenCalled();
      cleanup();
      const online = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
      render(failing('Failed to fetch dynamically imported module'));
      await screen.findByTestId('route-chunk-failed');
      expect(reload).not.toHaveBeenCalled();
      online.mockRestore();
    });
    it('Codex R18: a draft that could not be kept stays on the page: no reload, the message and the retry stay', async () => {
      flush.mockReturnValue(false);
      render(failing('Failed to fetch dynamically imported module'));
      await screen.findByTestId('route-chunk-failed');
      await waitFor(() => expect(flush).toHaveBeenCalled());
      expect(reload).not.toHaveBeenCalled();
      expect(window.sessionStorage.getItem('tekango-chunk-reload-at')).toBeNull();
    });
    it('storage blocked: no reload', async () => {
      const blocked = vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
      render(failing('Failed to fetch dynamically imported module'));
      await screen.findByTestId('route-chunk-failed');
      expect(reload).not.toHaveBeenCalled();
      blocked.mockRestore();
    });
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
