// Owner console 2026-10-27 (typed: "מאשר את תוכנית שלב 2 עם מנהל הסוכנים", decision 1: an article the Owner approved in the agents
// room is published automatically): the database guides - read (published rows only, checked), shown on the site, prerendered in the
// production build only, added to the sitemap, measured; the static guides always win and a bad row never reaches a page or the build.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { normalizeArticleRow, fetchPublishedArticles, articleView } from './shared/siteArticlesApi';
import { articleSeoRoute } from './shared/publicSeoRoutes';
import { isMeasuredPath } from './shared/siteAnalytics';
import { PublicArticle, PublicArticlesIndex } from './pages/PublicArticle';
import { withGuides, loadDatabaseGuides } from '../scripts/prerender-public-routes.mjs';
import { composeRouteHtml, validateRouteHtml } from '../scripts/publicRouteHtml.mjs';
import { renderPublicPage } from './entry-prerender';
import { PUBLIC_SEO_ROUTES } from './shared/publicSeoRoutes';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const lang = (h1, p) => ({ title: `TEKANGO - ${h1}`, description: `${p} ${p}`.slice(0, 200), h1, intro: p, sections: [{ h: `${h1} 1`, p: [p], list: ['a'] }] });
const row = { slug: 'hourly-pricing-guide', market: 'intl', status: 'published', published_at: '2026-11-02T08:00:00Z',
  he: lang('איך מתמחרים עבודה לפי שעה', 'מדריך קצר לבעלי עסקים.'), en: lang('How to price hourly work', 'A short guide for business owners.') };
const reply = (rows, ok = true) => vi.fn(async () => ({ ok, json: async () => rows }));

describe('the database guides', () => {
  it('a row is checked: a clean slug, both languages complete, a publication date, never a static guide\'s slug', () => {
    expect(normalizeArticleRow(row)).toMatchObject({ slug: 'hourly-pricing-guide', market: 'intl', date: '2026-11-02' });
    expect(normalizeArticleRow({ ...row, slug: 'Bad Slug' })).toBeNull();
    expect(normalizeArticleRow({ ...row, slug: 'quote-by-measurements' })).toBeNull(); // the static guide wins
    expect(normalizeArticleRow({ ...row, en: { ...row.en, sections: [] } })).toBeNull();
    expect(normalizeArticleRow({ ...row, published_at: null })).toBeNull();
  });

  it('reads the published rows with the public key only; any failure is an empty list', async () => {
    const f = reply([row, { slug: 'x' }]);
    const rows = await fetchPublishedArticles({ base: 'https://synthetic.supabase.co/', key: 'anon-key', fetchImpl: f });
    expect(rows.map((r) => r.slug)).toEqual(['hourly-pricing-guide']);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://synthetic.supabase.co/rest/v1/site_articles?select=slug%2Cmarket%2Che%2Cen%2Cpublished_at&status=eq.published&order=published_at.desc&limit=200');
    expect(init.headers).toMatchObject({ apikey: 'anon-key', Authorization: 'Bearer anon-key' });
    expect(await fetchPublishedArticles({ base: 'https://s.co', key: 'k', fetchImpl: reply([], false) })).toEqual([]);
    expect(await fetchPublishedArticles({ base: 'https://s.co', key: 'k', fetchImpl: vi.fn(async () => { throw new Error('offline'); }) })).toEqual([]);
    expect(await fetchPublishedArticles({ base: 'https://s.co', key: 'k', slug: '../x', fetchImpl: vi.fn() })).toEqual([]);
    expect(await fetchPublishedArticles({ base: '', key: 'k', fetchImpl: vi.fn() })).toEqual([]);
  });

  it('HE + EN: a database guide opens on the site with its own SEO signals; the index lists it after the static guides', async () => {
    for (const l of ['he', 'en']) {
      vi.stubGlobal('fetch', reply([row]));
      render(<MemoryRouter initialEntries={[`/${l}/articles/${row.slug}`]}><Routes><Route path={`/${l}/articles/:slug`} element={<PublicArticle lang={l} />} /></Routes></MemoryRouter>);
      await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(row[l].h1));
      await waitFor(() => expect(document.title).toBe(row[l].title)); // the SEO effect runs right after the guide renders
      expect(document.querySelector('meta[name="robots"]').getAttribute('content')).toBe('index, follow');
      expect(document.querySelector('link[rel="canonical"]').getAttribute('href')).toBe(`https://www.tekango.com/${l}/articles/${row.slug}`);
      cleanup();
      vi.stubGlobal('fetch', reply([row]));
      render(<MemoryRouter><PublicArticlesIndex lang={l} /></MemoryRouter>);
      await waitFor(() => expect(screen.getByTestId(`article-link-${row.slug}`).textContent).toBe(row[l].h1));
      const links = screen.getAllByRole('link').map((a) => a.getAttribute('data-testid')).filter((x) => x?.startsWith('article-link-'));
      expect(links.at(-1)).toBe(`article-link-${row.slug}`);
      cleanup();
    }
  });

  it('an unknown slug is a not-found page once the database answers', async () => {
    vi.stubGlobal('fetch', reply([]));
    render(<MemoryRouter initialEntries={['/he/articles/no-such-guide']}><Routes><Route path="/he/articles/:slug" element={<PublicArticle lang="he" />} /></Routes></MemoryRouter>);
    await waitFor(() => expect(document.title).toMatch(/לא נמצא/));
    expect(document.querySelector('meta[name="robots"]').getAttribute('content')).toMatch(/noindex/);
  });

  it('the build: only the production build reads the database; the sitemap gets both languages with hreflang', async () => {
    const entry = { fetchPublishedArticles: vi.fn(async () => [normalizeArticleRow(row)]) };
    expect(await loadDatabaseGuides(entry, () => {}, { VERCEL_ENV: 'preview' })).toEqual([]);
    expect(await loadDatabaseGuides(entry, () => {}, {})).toEqual([]);
    expect(entry.fetchPublishedArticles).not.toHaveBeenCalled();
    expect(await loadDatabaseGuides(entry, () => {}, { VERCEL_ENV: 'production', VITE_SUPABASE_URL: 'https://s.co', VITE_SUPABASE_ANON_KEY: 'k' })).toHaveLength(1);
    const xml = withGuides('<?xml version="1.0"?>\n<urlset>\n  <url><loc>https://www.tekango.com/he</loc></url>\n</urlset>\n', [normalizeArticleRow(row)]);
    expect(xml).toMatch(/<loc>https:\/\/www\.tekango\.com\/he\/articles\/hourly-pricing-guide<\/loc>\n {4}<lastmod>2026-11-02<\/lastmod>/);
    expect(xml).toMatch(/<loc>https:\/\/www\.tekango\.com\/en\/articles\/hourly-pricing-guide<\/loc>/);
    expect(xml.trim().endsWith('</urlset>')).toBe(true);
    const r = articleSeoRoute('en', row.slug, articleView(normalizeArticleRow(row), 'en'), '2026-11-02');
    expect(r).toMatchObject({ path: '/en/articles/hourly-pricing-guide', page: 'article', lang: 'en', title: row.en.title, hreflang: [{ lang: 'he', path: '/he/articles/hourly-pricing-guide' }, { lang: 'en', path: '/en/articles/hourly-pricing-guide' }] });
    expect(r.structuredData).toMatchObject({ '@type': 'Article', datePublished: '2026-11-02', inLanguage: 'en' });
  });

  it('the real prerender path: a database guide passes the SAME initial-HTML contract in both languages; a broken one fails it (and is skipped)', () => {
    const SHELL = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const heP = 'בעלי עסקים קטנים כותבים הצעות מחיר כל יום, וכדאי שכל הצעה תהיה ברורה, מסודרת וקלה לאישור עבור הלקוח שלכם. ';
    const enP = 'Small business owners write quotes every day, and every quote should be clear, organized and easy for the client to approve. ';
    const full = normalizeArticleRow({ ...row, he: lang('איך מתמחרים עבודה לפי שעה', heP.repeat(3)), en: lang('How to price hourly work', enP.repeat(3)) });
    for (const l of ['he', 'en']) {
      const route = articleSeoRoute(l, full.slug, full[l], full.date);
      const html = composeRouteHtml(SHELL, route, renderPublicPage({ ...route, data: articleView(full, l) }));
      expect(validateRouteHtml(route, html)).toEqual([]);
      expect(html).toContain(`<h1`);
      const index = PUBLIC_SEO_ROUTES.find((r) => r.path === `/${l}/articles`);
      expect(renderPublicPage({ ...index, extra: [full] })).toContain(`/${l}/articles/${full.slug}`);
    }
    const broken = { ...full, en: { ...full.en, intro: `${full.en.intro} שלום` } };
    const route = articleSeoRoute('en', broken.slug, broken.en, broken.date);
    expect(validateRouteHtml(route, composeRouteHtml(SHELL, route, renderPublicPage({ ...route, data: articleView(broken, 'en') })))).not.toEqual([]);
  });

  it('a database guide page is measured like every public page', () => {
    expect(isMeasuredPath('/he/articles/hourly-pricing-guide')).toBe(true);
    expect(isMeasuredPath('/en/articles/hourly-pricing-guide/')).toBe(true);
    expect(isMeasuredPath('/he/articles/Bad_Slug')).toBe(false);
    expect(isMeasuredPath('/dashboard')).toBe(false);
  });
});
