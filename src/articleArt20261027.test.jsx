// Owner console 2026-10-27, typed: "מאשר את האיורים" - an illustration on top of every guide and on its card in the index (HE + EN).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ART_KEYS, ART_ALT, articleArt, artSrc } from './shared/articleArt';
import { ARTICLE_SLUGS } from './shared/publicArticles';

vi.mock('./shared/siteArticlesApi', async (orig) => ({ ...(await orig()), fetchPublishedArticles: vi.fn(async () => []) }));
const { PublicArticle, PublicArticlesIndex } = await import('./pages/PublicArticle');

const HERE = path.dirname(fileURLToPath(import.meta.url));
afterEach(cleanup);

describe('the eight illustrations', () => {
  it('every key has its own SVG file (640x320, no text inside) and a description in both languages', () => {
    expect(ART_KEYS).toHaveLength(8);
    for (const key of ART_KEYS) {
      const svg = fs.readFileSync(path.resolve(HERE, '..', 'public', 'guides', 'art', `${key}.svg`), 'utf8');
      expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 640 320"/);
      expect(svg).not.toMatch(/<script|<foreignObject|href=|<image/); // a plain drawing: nothing external, nothing active
      for (const m of svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)) expect(m[1]).toMatch(/^[$€]$/); // only a currency sign, never words
      expect(ART_ALT[key].he).toMatch(/^איור: /);
      expect(ART_ALT[key].en).toMatch(/^Illustration: /);
      expect(artSrc(key)).toBe(`/guides/art/${key}.svg`);
    }
  });

  it('the static guides have a fixed illustration; a database guide gets one by its address words, else the general one', () => {
    expect(ARTICLE_SLUGS.map(articleArt)).toEqual(ARTICLE_SLUGS.map((s) => ({
      'how-to-write-a-quote-clients-approve': 'quote', 'renovation-contractor-quote': 'renovation',
      'quote-by-measurements': 'measure', 'import-pricing-currency-conversion': 'currency' })[s]));
    expect(articleArt('price-small-business-quotes')).toBe('pricing');
    expect(articleArt('commercial-cleaning-service-quote')).toBe('quote');
    expect(articleArt('how-to-follow-up-on-a-quote')).toBe('followup');
    expect(articleArt('send-a-quote-on-whatsapp')).toBe('send');
    expect(articleArt('digital-signature-on-quotes')).toBe('signature');
    expect(articleArt('painting-job-quote-per-room')).toBe('renovation');
    expect(articleArt('')).toBe('quote');
    expect(articleArt('reprice')).toBe('quote'); // whole words only
  });
});

describe('the article page and the index show it (HE + EN)', () => {
  it.each([['he'], ['en']])('%s: the guide opens with its illustration and the description in its language', (lang) => {
    render(<MemoryRouter><PublicArticle lang={lang} slug="quote-by-measurements" /></MemoryRouter>);
    const img = screen.getByTestId('article-art');
    expect(img.getAttribute('src')).toBe('/guides/art/measure.svg');
    expect(img.getAttribute('alt')).toBe(ART_ALT.measure[lang]);
    expect(img.getAttribute('width')).toBe('640');
    // the illustration comes before the title
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(img.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each([['he'], ['en']])('%s: every card in the index carries its illustration as decoration (empty alt), lazily loaded', async (lang) => {
    render(<MemoryRouter><PublicArticlesIndex lang={lang} extra={[]} /></MemoryRouter>);
    for (const slug of ARTICLE_SLUGS) {
      const img = screen.getByTestId(`article-art-${slug}`);
      expect(img.getAttribute('src')).toBe(artSrc(articleArt(slug)));
      expect(img.getAttribute('alt')).toBe('');
      expect(img.getAttribute('loading')).toBe('lazy');
    }
  });
});
