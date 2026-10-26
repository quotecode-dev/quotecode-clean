// Owner console 2026-10-26 (SEO week 2, the night task): the public guides - four articles in Hebrew and English plus an index page.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ARTICLES, ARTICLE_SLUGS, ARTICLES_INDEX } from './shared/publicArticles';
import { PUBLIC_SEO_ROUTES } from './shared/publicSeoRoutes';
import { PublicArticle, PublicArticlesIndex } from './pages/PublicArticle';

const text = (a) => [a.title, a.description, a.h1, a.intro, ...a.sections.flatMap((s) => [s.h, ...(s.p || []), ...(s.list || [])]), ...a.related.map((r) => r.label)].join('\n');
const paths = new Set(PUBLIC_SEO_ROUTES.map((r) => r.path));

describe('the public guides content', () => {
  it('every article exists in Hebrew and English with sections and related links', () => {
    expect(ARTICLE_SLUGS).toHaveLength(4);
    for (const slug of ARTICLE_SLUGS) {
      for (const lang of ['he', 'en']) {
        const a = ARTICLES[slug][lang];
        expect(a.title && a.description && a.h1 && a.intro).toBeTruthy();
        expect(a.sections.length).toBeGreaterThanOrEqual(4);
        for (const r of a.related) {
          expect(r.href.startsWith(`/${lang}/`)).toBe(true);
          expect(paths.has(r.href)).toBe(true);
        }
      }
    }
  });

  it('English pages carry no Hebrew, no shekel and no Israeli VAT', () => {
    for (const slug of ARTICLE_SLUGS) {
      const en = text(ARTICLES[slug].en);
      expect(en).not.toMatch(/[א-ת]/);
      expect(en).not.toMatch(/₪|\bILS\b|\bNIS\b|shekel|\bVAT\b/i);
    }
    expect(JSON.stringify(ARTICLES_INDEX.en)).not.toMatch(/[א-ת]|₪|\bILS\b/);
  });

  it('Hebrew pages use Hebrew gershayim in abbreviations and address the reader in the plural', () => {
    for (const slug of ARTICLE_SLUGS) {
      const he = text(ARTICLES[slug].he);
      expect(he).not.toMatch(/מע"מ|ש"ח|מ"ר|ס"מ|חו"ל/);
      expect(he).not.toMatch(/\bאתה\b|\bאת\s+צריכה\b/);
    }
  });

  it('every article and the index are public SEO routes in both languages', () => {
    for (const lang of ['he', 'en']) {
      expect(paths.has(`/${lang}/articles`)).toBe(true);
      for (const slug of ARTICLE_SLUGS) {
        const r = PUBLIC_SEO_ROUTES.find((x) => x.path === `/${lang}/articles/${slug}`);
        expect(r.title).toBe(ARTICLES[slug][lang].title);
        expect(r.structuredData['@type']).toBe('Article');
        expect(r.hreflang.map((h) => h.path).sort()).toEqual([`/en/articles/${slug}`, `/he/articles/${slug}`]);
      }
    }
  });
});

const at = (path, el) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/he/articles" element={<PublicArticlesIndex lang="he" />} />
      <Route path="/en/articles" element={<PublicArticlesIndex lang="en" />} />
      <Route path="/he/articles/:slug" element={<PublicArticle lang="he" />} />
      <Route path="/en/articles/:slug" element={<PublicArticle lang="en" />} />
      <Route path="*" element={el || null} />
    </Routes>
  </MemoryRouter>,
);

describe('the public guide pages', () => {
  it('a Hebrew article renders its own heading, RTL, and its own canonical', () => {
    at('/he/articles/quote-by-measurements');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(ARTICLES['quote-by-measurements'].he.h1);
    expect(document.querySelector('[dir="rtl"]')).not.toBeNull();
    expect(document.querySelector('link[rel="canonical"]').getAttribute('href')).toBe('https://www.tekango.com/he/articles/quote-by-measurements');
  });

  it('an English article renders LTR with its own canonical and the signup call to action', () => {
    at('/en/articles/import-pricing-currency-conversion');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(ARTICLES['import-pricing-currency-conversion'].en.h1);
    expect(document.querySelector('[dir="ltr"]')).not.toBeNull();
    expect(document.querySelector('link[rel="canonical"]').getAttribute('href')).toBe('https://www.tekango.com/en/articles/import-pricing-currency-conversion');
    expect(screen.getByTestId('article-cta').textContent).toBe('Create an account');
  });

  it('the index lists the four guides', () => {
    at('/he/articles');
    for (const slug of ARTICLE_SLUGS) expect(screen.getByTestId(`article-link-${slug}`).getAttribute('href')).toBe(`/he/articles/${slug}`);
  });

  it('an unknown article is a not-found page (noindex), never an empty indexable page', () => {
    at('/he/articles/no-such-guide');
    expect(document.querySelector('meta[name="robots"]').getAttribute('content')).toMatch(/noindex/);
  });
});
