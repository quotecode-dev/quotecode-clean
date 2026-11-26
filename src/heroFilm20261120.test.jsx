// Owner console 2026-11-20, typed: "מאשר את הטלפון החי בכרטיס הפתיחה כמו בסקיצה, כולל שינוי ב-L-02, ושחרור עד הלייב" - the real product on the
// hero phone's screen; the card, the copy and the ORIGINAL phone picture (angle, size, place) unchanged; today's size kept (Owner 20/11).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import HeroPhoneFilm from './components/landing/HeroPhoneFilm';
import { HERO_FILM } from './components/landing/heroFilm';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(here, f), 'utf8');
const pub = (p) => path.join(here, '..', 'public', p);
const origMM = window.matchMedia;
const origCan = HTMLMediaElement.prototype.canPlayType;
afterEach(() => { cleanup(); window.matchMedia = origMM; HTMLMediaElement.prototype.canPlayType = origCan; vi.useRealTimers(); vi.restoreAllMocks(); });
const motion = (reduce) => { window.matchMedia = (q) => ({ matches: reduce && /reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }); };
const phone = () => { const img = document.createElement('img'); img.getAnimations = () => []; document.body.appendChild(img); return { current: img }; };

describe('the original phone picture stays exactly as it is', () => {
  it('the same picture, the same sizes and attributes; the film is a separate layer after it', () => {
    const l = read('components/landing/LandingPage.jsx');
    expect(l).toContain("className=\"tl-hero-sequence-phone\"\n                src={isHe ? '/assets/landing/hero-phone-he.webp' : '/assets/landing/hero-phone-en.webp'}\n                width={isHe ? 809 : 920}\n                height={isHe ? 1419 : 1296}");
    expect(l).toContain("<HeroPhoneFilm lang={isHe ? 'he' : 'en'} phoneRef={heroPhoneRef} />");
    const css = read('components/landing/landing.css');
    expect(css).toContain('.tl-hero-film { position: absolute; z-index: 4; pointer-events: none; opacity: 0; transition: opacity .35s ease; }');
    expect(css).toContain('@media (prefers-reduced-motion: reduce) { .tl-hero-film { display: none; } }');
  });
  it('the geometry is measured on the same pictures; the films are light enough for the page', () => {
    expect(HERO_FILM.he.size).toEqual([809, 1419]);
    expect(HERO_FILM.en.size).toEqual([920, 1296]);
    for (const m of ['he', 'en']) {
      const g = HERO_FILM[m];
      expect(g.matrix3d).toMatch(/^matrix3d\(/);
      expect(g.clip.length).toBeGreaterThan(20);
      const size = fs.statSync(pub(g.film)).size;
      // Owner 2026-11-26: the film re-recorded from the simplified version in HD (720 px wide, was 360); the Owner chose the 8.7 MB
      // weight (1000 kb/s) over 11.4 / 13.1 MB. The limit keeps the film at that weight.
      expect(size).toBeLessThan(9 * 1024 * 1024);
      expect(size).toBeGreaterThan(6 * 1024 * 1024); // HD, not the old 360 px film
      expect(fs.existsSync(pub(g.island))).toBe(true);
    }
  });
});

describe('when the film runs', () => {
  it('"reduce motion": no layer at all - the original picture only', () => {
    motion(true); HTMLMediaElement.prototype.canPlayType = () => 'probably';
    const { container } = render(<HeroPhoneFilm lang="he" phoneRef={phone()} />);
    expect(container.querySelector('[data-testid="hero-phone-film"]')).toBeNull();
  });
  it('a browser that cannot play the film: no layer at all', () => {
    motion(false); HTMLMediaElement.prototype.canPlayType = () => '';
    const { container } = render(<HeroPhoneFilm lang="en" phoneRef={phone()} />);
    expect(container.querySelector('[data-testid="hero-phone-film"]')).toBeNull();
  });
  it('otherwise the layer is there but hidden; the film is fetched only after the page loaded and the phone landed, then it plays', async () => {
    motion(false); HTMLMediaElement.prototype.canPlayType = () => 'probably';
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const { container } = render(<HeroPhoneFilm lang="he" phoneRef={phone()} />);
    const layer = container.querySelector('[data-testid="hero-phone-film"]');
    expect(layer).not.toBeNull();
    expect(layer.className).toBe('tl-hero-film');
    const v = layer.querySelector('video');
    expect(v.getAttribute('preload')).toBe('none');
    expect(v.muted).toBe(true);
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(v.getAttribute('src')).toBe('/assets/landing/hero-film-he.webm');
    expect(play).toHaveBeenCalled();
    act(() => { v.dispatchEvent(new Event('playing')); });
    expect(layer.className).toBe('tl-hero-film is-on');
  });
});
