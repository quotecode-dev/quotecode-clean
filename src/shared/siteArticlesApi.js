// Owner console 2026-10-27 (typed: "מאשר את תוכנית שלב 2 עם מנהל הסוכנים" - decision 1: an article the Owner approved in the agents room
// is published automatically): the guides that live in the database (public.site_articles, status published - the only rows and columns
// the public may read, migration 20261027500000). ONE reader for both consumers:
//   * the site (src/pages/PublicArticle.jsx) - an article page / the guides index in the browser;
//   * the production build (scripts/prerender-public-routes.mjs) - the article's initial HTML and its sitemap entry, so Google sees a
//     full page (the agents-room function starts that build through the Vercel deploy hook after the Owner approves).
// The static guides (src/shared/publicArticles.js) always win: a database row with a static slug is ignored.
import { ARTICLE_SLUGS } from './publicArticles';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
const strs = (v, n, max) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.slice(0, n)).slice(0, max) : []);

function langOf(raw) {
  const l = raw && typeof raw === 'object' ? raw : {};
  const sections = (Array.isArray(l.sections) ? l.sections : []).slice(0, 8)
    .map((s) => ({ h: str(s?.h, 150), p: strs(s?.p, 1500, 4), list: strs(s?.list, 300, 10) }))
    .filter((s) => s.h && s.p.length);
  const out = { title: str(l.title, 140), description: str(l.description, 300), h1: str(l.h1, 110), intro: str(l.intro, 1200), sections };
  return out.title && out.description && out.h1 && out.intro && sections.length ? out : null;
}

// Codex R09 (Owner 2026-10-29, decision 4): why a published row is not usable - named with its slug when it stops the production build
function langProblem(raw, lang) {
  const l = raw && typeof raw === 'object' ? raw : null;
  if (!l) return `${lang}: no content`;
  const missing = ['title', 'description', 'h1', 'intro'].filter((k) => !str(l[k], 1200));
  if (missing.length) return `${lang}: missing ${missing.join(', ')}`;
  return `${lang}: no section with a heading and a paragraph`;
}
export function articleRowProblem(row) {
  if (!row || typeof row !== 'object') return 'not a row';
  if (!SLUG.test(String(row.slug || ''))) return 'invalid slug';
  if (!langOf(row.he)) return langProblem(row.he, 'he');
  if (!langOf(row.en)) return langProblem(row.en, 'en');
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(row.published_at || ''))) return 'no publication date';
  return null;
}

// one checked row: { slug, market, date, he, en } or null (a malformed row never reaches a page)
export function normalizeArticleRow(row) {
  if (!row || typeof row !== 'object' || !SLUG.test(String(row.slug || '')) || ARTICLE_SLUGS.includes(row.slug)) return null;
  const he = langOf(row.he); const en = langOf(row.en);
  const date = /^\d{4}-\d{2}-\d{2}/.test(String(row.published_at || '')) ? String(row.published_at).slice(0, 10) : null;
  if (!he || !en || !date) return null;
  return { slug: row.slug, market: row.market === 'il' ? 'il' : 'intl', date, he, en };
}

// the page view of one language: the article + its "related" links (the guides index and the free tools of the same language)
export function articleView(row, lang) {
  const a = row[lang];
  const related = lang === 'he'
    ? [{ href: '/he/articles', label: 'כל המדריכים' }, { href: '/he/tools', label: 'כלים חינמיים לעסקים' }]
    : [{ href: '/en/articles', label: 'All guides' }, { href: '/en/tools', label: 'Free business tools' }];
  return { ...a, related };
}

// Published rows, newest first (slug = one article). Never throws: a failure is an empty list (the static guides still stand).
// 20261029000000 (Codex F13): strict (the production build only) throws when the list could not be read - a failed read is never an
// empty catalog, so a build never drops the guides already published
export async function fetchPublishedArticles({ base, key, slug, fetchImpl = globalThis.fetch, timeoutMs = 8000, strict = false } = {}) {
  const unavailable = (why) => { if (strict) throw new Error(`articles_unavailable:${why}`); return []; };
  if (!base || !key || typeof fetchImpl !== 'function') return unavailable('not_configured');
  if (slug !== undefined && !SLUG.test(String(slug))) return [];
  const q = new URLSearchParams({ select: 'slug,market,he,en,published_at', status: 'eq.published', order: 'published_at.desc', limit: slug ? '1' : '200' });
  if (slug) q.set('slug', `eq.${slug}`);
  const abort = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = abort ? setTimeout(() => abort.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(`${String(base).replace(/\/$/, '')}/rest/v1/site_articles?${q}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' }, ...(abort ? { signal: abort.signal } : {}),
    });
    if (!res.ok) return unavailable(String(res.status));
    const rows = await res.json();
    if (!Array.isArray(rows)) return unavailable('malformed');
    // Codex N12: strict (the production build) never drops a published guide silently - an invalid one stops the build by name
    // (a row whose slug is a static guide is skipped on purpose: the static guide wins)
    const invalid = rows.filter((r) => normalizeArticleRow(r) === null && !(r && ARTICLE_SLUGS.includes(r.slug)));
    if (strict && invalid.length) {
      throw new Error(`articles_invalid:${invalid.map((r) => `${String(r?.slug || '?')} (${articleRowProblem(r) || 'invalid'})`).join('; ')}`);
    }
    return rows.map(normalizeArticleRow).filter(Boolean);
  } catch (e) {
    if (strict && /^articles_(unavailable|invalid):/.test(String(e?.message || ''))) throw e;
    return unavailable(e?.name === 'AbortError' ? 'timeout' : 'failed');
  } finally {
    if (timer) clearTimeout(timer);
  }
}
