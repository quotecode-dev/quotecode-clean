// Task 16 - QuoteMedia components: Modern rail, Visual hero, row thumbnail, missing-image fallback, item binding.
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { QuoteMediaRail, QuoteMediaHero, QuoteItemThumb } from './QuoteMedia';
import { normalizeItemKey, mediaForItem, MEDIA_UNAVAILABLE_LABEL } from './quoteMediaModel';

const img = (n, extra = {}) => ({
  url: `https://example.test/${n}.png`, caption: `Caption ${n}`, alt: `Alt ${n}`, role: 'item', itemKey: null, missing: false, ...extra,
});

describe('normalizeItemKey', () => {
  it('trims, collapses whitespace and lowercases', () => {
    expect(normalizeItemKey('  Custom   OAK\tShelving \n')).toBe('custom oak shelving');
    expect(normalizeItemKey('מדף  אלון ')).toBe('מדף אלון');
  });
  it('returns null for empty / non-string', () => {
    expect(normalizeItemKey('')).toBeNull();
    expect(normalizeItemKey('   ')).toBeNull();
    expect(normalizeItemKey(null)).toBeNull();
    expect(normalizeItemKey(undefined)).toBeNull();
    expect(normalizeItemKey(42)).toBeNull();
  });
});

describe('mediaForItem', () => {
  const media = [
    img('hero', { role: 'hero', itemKey: null }),
    img('support', { role: 'support', itemKey: 'solid oak worktop' }),
    img('shelf', { role: 'item', itemKey: 'custom oak shelving' }),
    img('shelf2', { role: 'item', itemKey: 'custom oak shelving' }),
  ];
  it('matches by normalized description', () => {
    expect(mediaForItem(media, '  Custom  Oak Shelving')).toBe(media[2]);
  });
  it('binds any role whose itemKey matches', () => {
    expect(mediaForItem(media, 'Solid oak WORKTOP')).toBe(media[1]);
  });
  it('prefers role item over another role with the same key', () => {
    const m = [img('s', { role: 'support', itemKey: 'x' }), img('i', { role: 'item', itemKey: 'x' })];
    expect(mediaForItem(m, 'X')).toBe(m[1]);
  });
  it('returns null when nothing matches or input is empty', () => {
    expect(mediaForItem(media, 'installation')).toBeNull();
    expect(mediaForItem(media, '')).toBeNull();
    expect(mediaForItem(null, 'custom oak shelving')).toBeNull();
    expect(mediaForItem([], 'custom oak shelving')).toBeNull();
  });
});

describe('QuoteMediaRail (Modern)', () => {
  it('renders null without media', () => {
    expect(render(<QuoteMediaRail media={[]} isHebrew={false} />).container.innerHTML).toBe('');
    expect(render(<QuoteMediaRail media={null} isHebrew />).container.innerHTML).toBe('');
    expect(render(<QuoteMediaRail isHebrew />).container.innerHTML).toBe('');
  });

  it('renders up to 6 figures with captions and capture-safe images', () => {
    const media = Array.from({ length: 8 }, (_, i) => img(i + 1));
    const { container } = render(<QuoteMediaRail media={media} isHebrew={false} />);
    const root = container.querySelector('.pq-media.pq-media-rail');
    expect(root).toBeTruthy();
    expect(root.getAttribute('dir')).toBe('ltr');
    const figures = root.querySelectorAll('figure.pq-media-figure');
    expect(figures).toHaveLength(6);
    expect(root.querySelectorAll('figcaption')[0].textContent).toBe('Caption 1');
    const images = root.querySelectorAll('img');
    expect(images).toHaveLength(6);
    for (const el of images) {
      expect(el.getAttribute('crossorigin')).toBe('anonymous');
      expect(el.getAttribute('decoding')).toBe('async');
      expect(el.getAttribute('loading')).toBe('eager');
      expect(el.getAttribute('referrerpolicy')).toBe('no-referrer');
      expect(el.getAttribute('width')).toBeTruthy();
      expect(el.getAttribute('height')).toBeTruthy();
    }
    expect(images[0].getAttribute('alt')).toBe('Alt 1');
    expect(root.querySelector('button, a, input, [role="button"]')).toBeNull();
  });

  it('uses the caption as alt text when alt is absent', () => {
    const { container } = render(<QuoteMediaRail media={[img(1, { alt: '' })]} isHebrew={false} />);
    expect(container.querySelector('img').getAttribute('alt')).toBe('Caption 1');
  });

  it('is rtl for Hebrew', () => {
    const { container } = render(<QuoteMediaRail media={[img(1)]} isHebrew />);
    expect(container.querySelector('.pq-media').getAttribute('dir')).toBe('rtl');
  });

  it('missing image => neutral tile, caption kept, localized label (EN + HE), no <img>', () => {
    const media = [img(1, { missing: true }), img(2, { url: null })];
    const en = render(<QuoteMediaRail media={media} isHebrew={false} />).container;
    expect(en.querySelectorAll('img')).toHaveLength(0);
    expect(en.querySelectorAll('[data-pq-media-state="missing"]')).toHaveLength(2);
    expect(en.querySelectorAll('.pq-media-missing-label')[0].textContent).toBe(MEDIA_UNAVAILABLE_LABEL.en);
    expect(en.textContent).toContain('Caption 1');
    expect(en.textContent).toContain('Caption 2');
    expect(en.textContent).not.toMatch(/IMG/);
    const he = render(<QuoteMediaRail media={[img(1, { missing: true })]} isHebrew />).container;
    expect(he.querySelector('.pq-media-missing-label').textContent).toBe('תמונה אינה זמינה');
  });

  it('switches to the fallback tile when the image fails to load', () => {
    const { container } = render(<QuoteMediaRail media={[img(1), img(2)]} isHebrew={false} />);
    fireEvent.error(container.querySelectorAll('img')[0]);
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(container.querySelectorAll('[data-pq-media-state="missing"]')).toHaveLength(1);
    expect(container.textContent).toContain(MEDIA_UNAVAILABLE_LABEL.en);
    expect(container.textContent).toContain('Caption 1');
  });

  it('respects explicit order', () => {
    const { container } = render(
      <QuoteMediaRail media={[img('b', { order: 2 }), img('a', { order: 1 })]} isHebrew={false} />,
    );
    expect([...container.querySelectorAll('figcaption')].map((n) => n.textContent)).toEqual(['Caption a', 'Caption b']);
  });
});

describe('QuoteMediaHero (Visual)', () => {
  it('renders null without media', () => {
    expect(render(<QuoteMediaHero media={[]} isHebrew={false} />).container.innerHTML).toBe('');
    expect(render(<QuoteMediaHero media={undefined} isHebrew />).container.innerHTML).toBe('');
  });

  it('picks role hero as the primary image and up to 4 supporting images', () => {
    const media = [img(1, { role: 'support' }), img(2, { role: 'item' }), img('H', { role: 'hero' }),
      img(3, { role: 'support' }), img(4, { role: 'support' }), img(5, { role: 'item' })];
    const { container } = render(<QuoteMediaHero media={media} isHebrew={false} />);
    const root = container.querySelector('.pq-media.pq-media-hero');
    expect(root.getAttribute('dir')).toBe('ltr');
    expect(root.querySelector('.pq-media-hero-main img').getAttribute('src')).toBe('https://example.test/H.png');
    expect(root.querySelector('.pq-media-hero-main figcaption').textContent).toBe('Caption H');
    expect(root.querySelectorAll('.pq-media-hero-side figure.pq-media-figure')).toHaveLength(4);
    expect(root.classList.contains('pq-media-hero--grid')).toBe(true);
  });

  it('falls back to the first image when there is no hero role; solo layout when alone', () => {
    const { container } = render(<QuoteMediaHero media={[img(1, { role: 'item' })]} isHebrew />);
    const root = container.querySelector('.pq-media-hero');
    expect(root.getAttribute('dir')).toBe('rtl');
    expect(root.classList.contains('pq-media-hero--solo')).toBe(true);
    expect(root.querySelector('.pq-media-hero-main img').getAttribute('src')).toBe('https://example.test/1.png');
    expect(root.querySelector('.pq-media-hero-side')).toBeNull();
  });

  it('missing hero keeps the caption and shows the localized label', () => {
    const { container } = render(<QuoteMediaHero media={[img('H', { role: 'hero', missing: true, url: null })]} isHebrew />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('Caption H');
    expect(container.textContent).toContain(MEDIA_UNAVAILABLE_LABEL.he);
  });

  it('onError on a supporting image switches only that image to the fallback', () => {
    const { container } = render(<QuoteMediaHero media={[img('H', { role: 'hero' }), img(1, { role: 'support' })]} isHebrew={false} />);
    fireEvent.error(container.querySelector('.pq-media-hero-side img'));
    expect(container.querySelector('.pq-media-hero-main img')).toBeTruthy();
    expect(container.querySelector('.pq-media-hero-side [data-pq-media-state="missing"]')).toBeTruthy();
  });
});

describe('QuoteItemThumb', () => {
  it('renders null without an image', () => {
    expect(render(<QuoteItemThumb image={null} isHebrew={false} />).container.innerHTML).toBe('');
  });

  it('renders a small capture-safe image with alt from alt || caption, inside a span (cell-safe)', () => {
    const { container } = render(<table><tbody><tr><td><QuoteItemThumb image={img(1, { alt: '' })} isHebrew={false} /> Desc</td></tr></tbody></table>);
    expect(container.querySelectorAll('td')).toHaveLength(1);
    const root = container.querySelector('td > span.pq-media.pq-media-thumb');
    expect(root).toBeTruthy();
    expect(root.querySelector('div')).toBeNull();
    const el = root.querySelector('img');
    expect(el.getAttribute('alt')).toBe('Caption 1');
    expect(el.getAttribute('crossorigin')).toBe('anonymous');
    expect(el.getAttribute('loading')).toBe('eager');
  });

  it('missing thumbnail => neutral tile with an accessible localized label', () => {
    const { container } = render(<QuoteItemThumb image={img(1, { missing: true })} isHebrew />);
    const tile = container.querySelector('[data-pq-media-state="missing"]');
    expect(tile.getAttribute('role')).toBe('img');
    expect(tile.getAttribute('aria-label')).toContain(MEDIA_UNAVAILABLE_LABEL.he);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.pq-media-thumb').getAttribute('dir')).toBe('rtl');
  });
});
