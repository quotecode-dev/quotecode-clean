// Regression gates for the Google indexing root-canonical defect (Search Console 2026-09-28: /en = "Duplicate, Google chose
// different canonical than user", Google canonical "/"). The live SPA served ONE index.html for every route - canonical "/",
// lang="en", empty #root - so a crawler's first fetch of /en (and every other public page) advertised the homepage. These gates
// fail if any intended public sitemap route loses its own initial-HTML signals again. They run the REAL page components through the
// REAL prerender entry + the REAL SPA shell, and inspect the result WITHOUT executing any JavaScript.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

vi.mock('./shared/supabase', () => ({
  supabase: { auth: { getSession: () => Promise.resolve({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } },
  rootRecoveryIntent: { isRecovery: false, isError: false },
  rootSignupIntent: { isSignup: false },
  consumeRootRecoveryIntent: () => {},
  consumeRootSignupIntent: () => {},
  isLocalTestMode: false,
}));

import { PUBLIC_SEO_ROUTES, publicSeo, publicSeoFor, LANDING_HREFLANG } from './shared/publicSeoRoutes';
import { renderPublicPage } from './entry-prerender';
import { composeRouteHtml, validateRouteHtml, inspectRouteHtml, sitemapPaths, CANONICAL_ORIGIN } from '../scripts/publicRouteHtml.mjs';
import { PRIVATE_ROUTE_PREFIXES } from '../scripts/prerender-public-routes.mjs';

const ROOT = process.cwd(); // vitest root = the repository root (vite.config.js)
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const SHELL = read('index.html');
const SITEMAP = read('public/sitemap.xml');
const VERCEL = JSON.parse(read('vercel.json'));
const byPath = (p) => PUBLIC_SEO_ROUTES.find((r) => r.path === p);
const generated = (p) => composeRouteHtml(SHELL, byPath(p), renderPublicPage(byPath(p)));

describe('public route authority <-> sitemap parity', () => {
  it('every sitemap <loc> is a registered public SEO route and vice versa (no drift)', () => {
    expect([...sitemapPaths(SITEMAP)].sort()).toEqual(PUBLIC_SEO_ROUTES.map((r) => r.path).sort());
  });

  it('"/" is not a sitemap page (it is a server-side locale redirect), but stays the landing x-default', () => {
    expect(sitemapPaths(SITEMAP)).not.toContain('/');
    expect(LANDING_HREFLANG).toContainEqual({ lang: 'x-default', path: '/' });
    expect(PUBLIC_SEO_ROUTES.some((r) => r.path === '/')).toBe(false);
  });

  it('sitemap hreflang alternates equal the route table for every URL', () => {
    for (const block of SITEMAP.split('<url>').slice(1)) {
      const loc = new URL(block.match(/<loc>([^<]+)<\/loc>/)[1]).pathname;
      const alts = [...block.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => `${m[1]}=${new URL(m[2]).pathname}`).sort();
      expect(alts).toEqual(byPath(loc).hreflang.map((h) => `${h.lang}=${h.path}`).sort());
    }
  });

  it('HE routes are Local / Hebrew and EN routes are International / English, in reciprocal pairs', () => {
    for (const r of PUBLIC_SEO_ROUTES) {
      expect(r.path.startsWith(`/${r.lang}`)).toBe(true);
      const twin = byPath(r.path.replace(/^\/(he|en)/, r.lang === 'he' ? '/en' : '/he'));
      expect(twin && twin.page === r.page && twin.lang !== r.lang).toBe(true);
      expect(r.hreflang).toEqual(twin.hreflang);
    }
  });

  it('no private / authenticated route is a public SEO route', () => {
    for (const r of PUBLIC_SEO_ROUTES) expect(PRIVATE_ROUTE_PREFIXES.some((x) => r.path === x || r.path.startsWith(`${x}/`))).toBe(false);
  });
});

describe('initial HTML of every public sitemap route (no JavaScript)', () => {
  it.each(PUBLIC_SEO_ROUTES.map((r) => [r.path]))('%s passes the full initial-HTML contract', (p) => {
    expect(validateRouteHtml(byPath(p), generated(p))).toEqual([]);
  });

  it('raw /en declares /en - never the homepage (the exact Search Console defect)', () => {
    const s = inspectRouteHtml(generated('/en'));
    expect(s.canonicals).toEqual([`${CANONICAL_ORIGIN}/en`]);
    expect(s.lang).toBe('en');
    expect(s.dir).toBe('ltr');
  });

  it('raw /he declares /he - never the homepage - and is Hebrew / RTL before JS', () => {
    const s = inspectRouteHtml(generated('/he'));
    expect(s.canonicals).toEqual([`${CANONICAL_ORIGIN}/he`]);
    expect(s.lang).toBe('he');
    expect(s.dir).toBe('rtl');
    expect(s.hebrewLetters).toBeGreaterThan(1000);
  });

  it('no generated page carries the homepage canonical, a second canonical or a leftover English <noscript>', () => {
    for (const r of PUBLIC_SEO_ROUTES) {
      const s = inspectRouteHtml(generated(r.path));
      expect(s.canonicals).toEqual([`${CANONICAL_ORIGIN}${r.path}`]);
      expect(s.hasNoscript).toBe(false);
      expect(s.jsonLdCount).toBeLessThanOrEqual(1);
    }
  });

  it('market separation before JS: Local landing ILS only, International landing no ILS, EN pages no Hebrew', () => {
    const he = inspectRouteHtml(generated('/he')).rootText;
    const en = inspectRouteHtml(generated('/en')).rootText;
    expect(he).toMatch(/₪/);
    expect(he).not.toMatch(/\$|USD/);
    expect(en).toMatch(/\$/);
    expect(en).not.toMatch(/₪|ILS|NIS/);
    for (const r of PUBLIC_SEO_ROUTES.filter((x) => x.lang === 'en')) expect(inspectRouteHtml(generated(r.path)).hebrewLetters).toBe(0);
  });
});

describe('negative controls - the gates detect the defect classes', () => {
  const liveShapeShell = SHELL.replace('</head>', `<link rel="canonical" href="${CANONICAL_ORIGIN}/" /></head>`);

  it('the pre-fix live document (homepage canonical, empty #root, lang=en) FAILS for /en and /he', () => {
    for (const p of ['/en', '/he']) {
      const errors = validateRouteHtml(byPath(p), liveShapeShell).join(' | ');
      expect(errors).toMatch(/canonical/);
      expect(errors).toMatch(/#root has only/);
    }
    expect(validateRouteHtml(byPath('/he'), liveShapeShell).join(' | ')).toMatch(/lang en != he/);
  });

  it('wrong-locale content is rejected in both directions', () => {
    const heWithEnglish = composeRouteHtml(SHELL, byPath('/he'), renderPublicPage(byPath('/en')));
    const enWithHebrew = composeRouteHtml(SHELL, byPath('/en'), renderPublicPage(byPath('/he')));
    expect(validateRouteHtml(byPath('/he'), heWithEnglish).join(' | ')).toMatch(/not predominantly Hebrew/);
    expect(validateRouteHtml(byPath('/en'), enWithHebrew).join(' | ')).toMatch(/Hebrew letters/);
  });

  it('a USD price in the Local landing is rejected', () => {
    const html = composeRouteHtml(SHELL, byPath('/he'), `${renderPublicPage(byPath('/he'))}<p>$12</p>`);
    expect(validateRouteHtml(byPath('/he'), html).join(' | ')).toMatch(/USD/);
  });
});

describe('SPA shell / hosting contracts', () => {
  it('the shell served to non-prerendered routes no longer advertises the homepage canonical / hreflang / og:url', () => {
    expect(SHELL).not.toMatch(/<link rel="canonical"/);
    expect(SHELL).not.toMatch(/hreflang=/);
    expect(SHELL).not.toMatch(/property="og:url"/);
    expect(SHELL).toMatch(/<meta name="google-site-verification"/);
  });

  it('the catch-all rewrite, the noindex headers and the legacy-host redirects are unchanged', () => {
    expect(VERCEL.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }]);
    const xrt = Object.fromEntries(VERCEL.headers.filter((h) => h.headers.some((x) => x.key === 'X-Robots-Tag')).map((h) => [h.source, h.headers.find((x) => x.key === 'X-Robots-Tag').value]));
    for (const p of ['/quote/:id', '/public-quote/:id', '/en/public-quote/:id', '/professional-preview', '/public-quote/:id/preview', '/dashboard', '/ai-logs']) expect(xrt[p]).toBe('noindex, nofollow');
    for (const p of ['/contact', '/privacy', '/terms', '/tools']) expect(xrt[p]).toBe('noindex, follow');
    expect(VERCEL.redirects.map((r) => r.has[0].value).sort()).toEqual(['quotecode.vercel.app', 'quotecodepro.com', 'www.quotecodepro.com']);
  });

  it('every client build runs the prerender gate (vite plugin, not an optional script)', () => {
    expect(read('vite.config.js')).toMatch(/plugins: \[[^\]]*prerenderPublicRoutesPlugin\(\)\]/);
  });
});

describe('one SEO authority - the live pages read the same table', () => {
  const pages = {
    'src/pages/LandingLocal.jsx': "publicSeo('/he')",
    'src/pages/LandingGlobal.jsx': "publicSeo('/en')",
    'src/components/PublicTools.jsx': "publicSeo('/he/tools')",
    'src/components/PublicToolsEn.jsx': "publicSeo('/en/tools')",
    'src/pages/Contact.jsx': "publicSeoFor('contact'",
    'src/pages/Privacy.jsx': "publicSeoFor('privacy'",
    'src/pages/Terms.jsx': "publicSeoFor('terms'",
  };
  it.each(Object.entries(pages))('%s calls setSeoMeta with the shared entry and no inline title', (file, call) => {
    const src = read(file);
    expect(src).toContain(`setSeoMeta(${call}`);
    expect(src).not.toMatch(/setSeoMeta\(\{\s*title:/);
  });

  it('publicSeo / publicSeoFor return the route itself as canonical and refuse unknown routes', () => {
    expect(publicSeo('/en').canonicalPath).toBe('/en');
    expect(publicSeoFor('contact', 'he').canonicalPath).toBe('/he/contact');
    expect(() => publicSeo('/')).toThrow();
    expect(() => publicSeo('/dashboard')).toThrow();
  });
});
