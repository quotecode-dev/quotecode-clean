// Build step: write route-specific INITIAL HTML for every public sitemap route (Google indexing root-canonical remediation, 2026-09-28).
//
// Runs automatically at the end of every client `vite build` (prerenderPublicRoutesPlugin in vite.config.js), so it cannot be
// skipped whichever build command the host uses (`vite build` or `npm run build`). Steps:
//   1. `vite build --ssr src/entry-prerender.jsx` into node_modules/.tekango-prerender (git-ignored, removed afterwards);
//   2. for every <loc> of dist/sitemap.xml: its entry in src/shared/publicSeoRoutes.js + its server-rendered page markup
//      -> dist/<path>/index.html (canonical = itself, lang/dir, title, description, hreflang, robots, og:*, JSON-LD, real content);
//   3. validate every written file WITHOUT JavaScript (scripts/publicRouteHtml.mjs) and FAIL THE BUILD on any violation:
//      a sitemap route without an SEO entry or without generated HTML, a public SEO entry missing from the sitemap, a wrong
//      canonical / locale / hreflang, too little content, wrong-locale or wrong-market content, or a private route generated.
// Vercel serves an existing static file before the `/(.*)` -> /index.html rewrite, so /he, /en, /he/contact ... get their own
// document and every other route (dashboard, public quotes, aliases) keeps the unchanged SPA shell.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { composeRouteHtml, validateRouteHtml, sitemapPaths, withArticleData } from './publicRouteHtml.mjs';

// Never generated as public marketing HTML, even if someone adds them to the sitemap by mistake.
export const PRIVATE_ROUTE_PREFIXES = ['/dashboard', '/ai-logs', '/quote', '/public-quote', '/en/public-quote', '/professional-preview'];

export async function prerenderPublicRoutes({ root, outDir, mode, log = console.log }) {
  const ssrOut = resolve(root, 'node_modules/.tekango-prerender');
  const { build } = await import('vite');
  process.env.TEKANGO_PRERENDER_SSR = '1'; // the nested SSR build must not re-enter this step
  try {
    await build({
      root,
      configFile: resolve(root, 'vite.config.js'),
      mode,
      logLevel: 'warn',
      build: { ssr: resolve(root, 'src/entry-prerender.jsx'), outDir: ssrOut, emptyOutDir: true, copyPublicDir: false },
    });
  } finally {
    delete process.env.TEKANGO_PRERENDER_SSR;
  }
  try {
    const entry = await import(pathToFileURL(join(ssrOut, 'entry-prerender.js')).href);
    const shell = readFileSync(join(outDir, 'index.html'), 'utf8');
    const sitemap = readFileSync(join(outDir, 'sitemap.xml'), 'utf8');
    const routes = new Map(entry.PUBLIC_SEO_ROUTES.map((r) => [r.path, r]));
    const paths = sitemapPaths(sitemap);
    const failures = [];
    for (const p of paths) {
      if (PRIVATE_ROUTE_PREFIXES.some((x) => p === x || p.startsWith(`${x}/`))) failures.push(`${p}: private route listed in the sitemap`);
      if (!routes.has(p)) failures.push(`${p}: sitemap route has no entry in src/shared/publicSeoRoutes.js`);
    }
    for (const p of routes.keys()) if (!paths.includes(p)) failures.push(`${p}: public SEO route missing from the sitemap`);
    if (failures.length) throw new Error(`prerender: sitemap / route parity failed:\n  ${failures.join('\n  ')}`);

    const matrix = [];
    const dbRows = await loadDatabaseGuides(entry, log);
    for (const p of paths) {
      const route = routes.get(p);
      const html = composeRouteHtml(shell, route, entry.renderPublicPage(route.page === 'articles' ? { ...route, extra: dbRows } : route));
      const errors = validateRouteHtml(route, html);
      if (errors.length) failures.push(`${p}: ${errors.join('; ')}`);
      const dir = join(outDir, ...p.split('/').filter(Boolean));
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'index.html'), html);
      matrix.push(`${p} -> ${join(...p.split('/').filter(Boolean), 'index.html')} ${errors.length ? 'FAIL' : 'ok'}`);
    }
    // the database guides (Owner 2026-10-27): each language pair passes the SAME contract. Codex N12 (Owner 2026-10-28, decision 4): a
    // published guide that fails it stops the production build by name and reason - the live site keeps serving it as it is
    const added = [];
    for (const row of dbRows) {
      const pair = ['he', 'en'].map((lang) => {
        const route = entry.articleSeoRoute(lang, row.slug, row[lang], row.date);
        const view = entry.articleView(row, lang);
        const html = withArticleData(composeRouteHtml(shell, route, entry.renderPublicPage({ ...route, data: view })), { slug: row.slug, lang, view, date: row.date });
        return { route, html, errors: validateRouteHtml(route, html) };
      });
      const bad = pair.filter((x) => x.errors.length);
      if (bad.length) { failures.push(`database guide ${row.slug}: ${bad.map((x) => `${x.route.path}: ${x.errors.join('; ')}`).join(' | ')}`); continue; }
      for (const x of pair) {
        const dir = join(outDir, ...x.route.path.split('/').filter(Boolean));
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'index.html'), x.html);
        matrix.push(`${x.route.path} -> database guide ok`);
      }
      added.push(row);
    }
    if (added.length) writeFileSync(join(outDir, 'sitemap.xml'), withGuides(sitemap, added));
    log(`prerender: ${paths.length} public routes + ${added.length * 2} database guide pages\n  ${matrix.join('\n  ')}`);
    if (failures.length) throw new Error(`prerender: initial-HTML contract failed:\n  ${failures.join('\n  ')}`);
    return { routes: paths.length, databaseGuides: added.length };
  } finally {
    rmSync(ssrOut, { recursive: true, force: true });
  }
}

// Owner console 2026-10-27 (typed: "מאשר את תוכנית שלב 2 עם מנהל הסוכנים", decision 1: an approved article is published automatically):
// the guides the Owner approved in the agents room (public.site_articles, published rows - public content, read with the public key).
// Only the PRODUCTION build on Vercel reads them (VERCEL_ENV=production); every other build (local, the release gate, previews) has
// none, so the release-gated output never depends on the database.
// 20261029000000 (Codex F13): a read that failed is tried 3 times; still failing, the production build fails, so Vercel keeps serving the
// current site with every published guide (an empty list would have dropped them from the pages and the sitemap)
export async function loadDatabaseGuides(entry, log = console.log, env = process.env, wait = (ms) => new Promise((r) => setTimeout(r, ms))) {
  if (env.VERCEL_ENV !== 'production') return [];
  let last = null;
  for (const pause of [0, 2000, 5000]) {
    if (pause) await wait(pause);
    try {
      const rows = await entry.fetchPublishedArticles({ base: env.VITE_SUPABASE_URL, key: env.VITE_SUPABASE_ANON_KEY, strict: true });
      log(`prerender: ${rows.length} database guides`);
      return rows;
    } catch (e) {
      last = e; log(`prerender: reading the database guides failed (${e?.message || 'failed'})`);
      if (/^articles_invalid:/.test(String(e?.message || ''))) break; // Codex N12: an invalid guide is not fixed by trying again
    }
  }
  throw new Error(`prerender: the database guides could not be read, or a published guide is invalid - the build stops so the live site keeps them (${last?.message || 'failed'})`);
}

const SITE = 'https://www.tekango.com';
export function withGuides(sitemapXml, rows) {
  const urls = rows.flatMap((r) => ['he', 'en'].map((lang) => [
    '  <url>',
    `    <loc>${SITE}/${lang}/articles/${r.slug}</loc>`,
    `    <lastmod>${r.date}</lastmod>`,
    '    <changefreq>monthly</changefreq>',
    '    <priority>0.7</priority>',
    `    <xhtml:link rel="alternate" hreflang="en" href="${SITE}/en/articles/${r.slug}" />`,
    `    <xhtml:link rel="alternate" hreflang="he" href="${SITE}/he/articles/${r.slug}" />`,
    '  </url>',
  ].join('\n')));
  return sitemapXml.replace(/\s*<\/urlset>\s*$/, `\n${urls.join('\n')}\n</urlset>\n`);
}

export function prerenderPublicRoutesPlugin() {
  let config;
  return {
    name: 'tekango-prerender-public-routes',
    apply: 'build',
    configResolved(c) { config = c; },
    async closeBundle() {
      if (config.build.ssr || process.env.TEKANGO_PRERENDER_SSR === '1') return;
      const outDir = resolve(config.root, config.build.outDir);
      if (!existsSync(join(outDir, 'index.html'))) return; // a failed / partial client build - nothing to prerender
      await prerenderPublicRoutes({ root: config.root, outDir, mode: config.mode });
    },
  };
}
