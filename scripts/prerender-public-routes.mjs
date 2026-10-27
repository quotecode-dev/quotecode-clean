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
import { composeRouteHtml, validateRouteHtml, sitemapPaths } from './publicRouteHtml.mjs';

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
    for (const p of paths) {
      const route = routes.get(p);
      const html = composeRouteHtml(shell, route, entry.renderPublicPage(route));
      const errors = validateRouteHtml(route, html);
      if (errors.length) failures.push(`${p}: ${errors.join('; ')}`);
      const dir = join(outDir, ...p.split('/').filter(Boolean));
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'index.html'), html);
      matrix.push(`${p} -> ${join(...p.split('/').filter(Boolean), 'index.html')} ${errors.length ? 'FAIL' : 'ok'}`);
    }
    log(`prerender: ${paths.length} public routes\n  ${matrix.join('\n  ')}`);
    if (failures.length) throw new Error(`prerender: initial-HTML contract failed:\n  ${failures.join('\n  ')}`);
    return { routes: paths.length };
  } finally {
    rmSync(ssrOut, { recursive: true, force: true });
  }
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
