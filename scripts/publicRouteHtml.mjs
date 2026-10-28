// Pure helpers of the public-route prerender (Google indexing root-canonical remediation, 2026-09-28): compose the INITIAL HTML of
// one public route from the built SPA shell + the route's SEO entry (src/shared/publicSeoRoutes.js) + its server-rendered markup,
// and inspect / validate such a document WITHOUT running any JavaScript (exactly what a crawler's first fetch sees).
// No I/O here - used by scripts/prerender-public-routes.mjs (build) and by the vitest gates.

export const CANONICAL_ORIGIN = 'https://www.tekango.com';

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const absolute = (path) => `${CANONICAL_ORIGIN}${path}`;

function replaceOnce(html, re, replacement, what) {
  if (!re.test(html)) throw new Error(`prerender: the SPA shell has no ${what}`);
  return html.replace(re, replacement);
}

// shell = the built dist/index.html (no canonical / hreflang / og:url of its own - see index.html).
export function composeRouteHtml(shell, route, markup) {
  if (!markup || typeof markup !== 'string') throw new Error(`prerender: empty markup for ${route.path}`);
  const dir = route.lang === 'he' ? 'rtl' : 'ltr';
  const ogLocale = route.lang === 'he' ? 'he_IL' : 'en_US';
  const ogAlt = route.lang === 'he' ? 'en_US' : 'he_IL';
  let html = shell;
  html = replaceOnce(html, /<html[^>]*>/, `<html lang="${route.lang}" dir="${dir}">`, '<html> tag');
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${escText(route.title)}</title>`, '<title>');
  html = replaceOnce(html, /<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${escAttr(route.description)}" />`, 'description meta');
  html = replaceOnce(html, /<meta name="robots" content="[^"]*"\s*\/?>/, '<meta name="robots" content="index, follow" />', 'robots meta');
  html = replaceOnce(html, /<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${escAttr(route.title)}" />`, 'og:title');
  html = replaceOnce(html, /<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${escAttr(route.description)}" />`, 'og:description');
  html = replaceOnce(html, /<meta property="og:locale" content="[^"]*"\s*\/?>/, `<meta property="og:locale" content="${ogLocale}" />`, 'og:locale');
  html = replaceOnce(html, /<meta property="og:locale:alternate" content="[^"]*"\s*\/?>/, `<meta property="og:locale:alternate" content="${ogAlt}" />`, 'og:locale:alternate');
  html = replaceOnce(html, /<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${escAttr(route.title)}" />`, 'twitter:title');
  html = replaceOnce(html, /<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${escAttr(route.description)}" />`, 'twitter:description');
  // The shell's generic SoftwareApplication JSON-LD (USD) is removed; a route with its own structured data carries it under the SAME
  // id setSeoMeta() maintains client-side, so the client updates this tag instead of adding a duplicate.
  html = replaceOnce(html, /\s*<script type="application\/ld\+json" id="proflow-static-structured-data">[\s\S]*?<\/script>/, '', 'static JSON-LD');
  const head = [
    `<link rel="canonical" href="${absolute(route.path)}" />`,
    ...route.hreflang.map((h) => `<link rel="alternate" hreflang="${h.lang}" href="${absolute(h.path)}" />`),
    `<meta property="og:url" content="${absolute(route.path)}" />`,
    ...(route.structuredData
      ? [`<script type="application/ld+json" id="proflow-structured-data-override">${JSON.stringify(route.structuredData).replace(/</g, '\\u003c')}</script>`]
      : []),
  ].map((l) => `    ${l}`).join('\n');
  html = replaceOnce(html, /<\/head>/, `${head}\n  </head>`, '</head>');
  // The shell's English <noscript> fallback would be wrong-locale content on a Hebrew page; the real page markup replaces it.
  html = html.replace(/\s*<noscript>[\s\S]*?<\/noscript>/, '');
  html = replaceOnce(html, /<div id="root"><\/div>/, () => `<div id="root">${markup}</div>`, 'empty #root');
  return html;
}

const pick = (html, re) => (html.match(re) || [])[1] ?? null;
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// Signals of an HTML document exactly as a non-JS crawler reads them.
export function inspectRouteHtml(html) {
  // #root content = from the root div up to whatever the shell puts after it (the <noscript> fallback or the module script) - the
  // <noscript> text is NOT page content and must never count as "meaningful content before JS".
  const rootStart = html.indexOf('<div id="root">');
  const ends = ['<noscript>', '<script type="module"'].map((m) => html.indexOf(m, rootStart)).filter((i) => i > rootStart);
  const rootHtml = rootStart >= 0 ? html.slice(rootStart + '<div id="root">'.length, ends.length ? Math.min(...ends) : undefined) : '';
  const rootText = decode(rootHtml.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  return {
    lang: pick(html, /<html[^>]*\slang="([^"]*)"/),
    dir: pick(html, /<html[^>]*\sdir="([^"]*)"/),
    title: (() => { const t = pick(html, /<title>([^<]*)<\/title>/); return t === null ? null : decode(t); })(),
    description: (() => { const d = pick(html, /<meta name="description" content="([^"]*)"/); return d === null ? null : decode(d); })(),
    robots: pick(html, /<meta name="robots" content="([^"]*)"/),
    canonicals: [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map((m) => m[1]),
    hreflang: [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => ({ lang: m[1], href: m[2] })),
    ogUrl: pick(html, /<meta property="og:url" content="([^"]*)"/),
    jsonLdCount: (html.match(/<script type="application\/ld\+json"/g) || []).length,
    hasNoscript: /<noscript>/.test(html),
    rootText,
    hebrewLetters: (rootText.match(/[\u05D0-\u05EA]/g) || []).length,
    latinLetters: (rootText.match(/[A-Za-z]/g) || []).length,
  };
}

// Minimum meaningful content inside #root before JS (the empty SPA shell has 0).
export const MIN_ROOT_TEXT_CHARS = 200;

// The terminal contract of one prerendered public route. Returns a list of violations (empty = PASS).
export function validateRouteHtml(route, html) {
  const s = inspectRouteHtml(html);
  const errors = [];
  const self = absolute(route.path);
  if (s.canonicals.length !== 1 || s.canonicals[0] !== self) errors.push(`canonical ${JSON.stringify(s.canonicals)} != ${self}`);
  if (s.canonicals.includes(`${CANONICAL_ORIGIN}/`)) errors.push('homepage canonical leaked');
  if (s.lang !== route.lang) errors.push(`lang ${s.lang} != ${route.lang}`);
  if (s.dir !== (route.lang === 'he' ? 'rtl' : 'ltr')) errors.push(`dir ${s.dir} wrong for ${route.lang}`);
  if (s.title !== route.title) errors.push('title is not the route title');
  if (s.description !== route.description) errors.push('description is not the route description');
  if (s.robots !== 'index, follow') errors.push(`robots ${s.robots}`);
  if (s.ogUrl !== self) errors.push(`og:url ${s.ogUrl}`);
  const want = route.hreflang.map((h) => `${h.lang}=${absolute(h.path)}`).sort().join(' ');
  const got = s.hreflang.map((h) => `${h.lang}=${h.href}`).sort().join(' ');
  if (want !== got) errors.push(`hreflang [${got}] != [${want}]`);
  if (s.jsonLdCount > 1) errors.push(`${s.jsonLdCount} JSON-LD blocks`);
  if (s.hasNoscript) errors.push('shell <noscript> fallback left in the page');
  if (s.rootText.length < MIN_ROOT_TEXT_CHARS) errors.push(`#root has only ${s.rootText.length} chars of text`);
  // No wrong-locale first content (locked §55.11): Hebrew pages are predominantly Hebrew; English pages carry no Hebrew at all.
  if (route.lang === 'he' && !(s.hebrewLetters >= 100 && s.hebrewLetters > s.latinLetters)) errors.push(`Hebrew page not predominantly Hebrew (he=${s.hebrewLetters}, latin=${s.latinLetters})`);
  if (route.lang === 'en' && s.hebrewLetters > 0) errors.push(`English page contains ${s.hebrewLetters} Hebrew letters`);
  // Market separation on the landing pages (pricing): Local = ILS only, International = no ILS.
  if (route.page === 'landing' && route.lang === 'he' && /\$|USD/.test(s.rootText)) errors.push('Local landing shows USD / $');
  if (route.page === 'landing' && route.lang === 'en' && /₪|ILS|NIS/.test(s.rootText)) errors.push('International landing shows ILS');
  return errors;
}

// <loc> paths of a sitemap.xml (origin stripped).
export function sitemapPaths(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1].trim()).pathname.replace(/(.)\/$/, '$1'));
}
