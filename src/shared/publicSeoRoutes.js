// The ONE route / SEO authority for every intended indexable public page (Google indexing root-canonical remediation, 2026-09-28).
//
// Why: the SPA served a single index.html (canonical "/", lang="en") for EVERY route; the right per-route signals appeared only after
// JavaScript ran (setSeoMeta). Google crawled /en, saw the homepage canonical in the initial HTML plus content identical to the root,
// and chose "/" as canonical ("Duplicate, Google chose different canonical than user", Search Console 2026-09-28).
//
// Consumers (all read THIS table - no second copy of any title / description / hreflang):
// - the pages themselves (LandingLocal / LandingGlobal / PublicTools / PublicToolsEn / Contact / Privacy / Terms) -> setSeoMeta();
// - scripts/prerender-public-routes.mjs -> writes dist/<path>/index.html with these signals + the page's own server-rendered
//   markup, so the INITIAL HTML (before any JS) is already correct;
// - the regression gates (publicSeoRoutes.test.js, prerenderedHtml.test.js) -> sitemap parity + locale rules.
//
// Locked policy (TEKANGO_AI_ARCHITECTURE.md §55.11): /he = Local canonical, /en = International canonical; "/" is NOT a page - the
// middleware resolves it to /he or /en server-side before any content paints (middleware.ts), so "/" is never a canonical and is
// only the hreflang x-default of the landing pair. HE entries are Hebrew / RTL / Local; EN entries are English / LTR / International.

export const LANDING_HREFLANG = [
  { lang: 'he', path: '/he' },
  { lang: 'en', path: '/en' },
  { lang: 'x-default', path: '/' },
];

const pair = (base) => [
  { lang: 'he', path: `/he${base}` },
  { lang: 'en', path: `/en${base}` },
];

export const PUBLIC_SEO_ROUTES = [
  {
    path: '/he',
    page: 'landing',
    lang: 'he',
    title: 'TEKANGO - מערכת SaaS לניהול עסק והפקת הצעות מחיר חכמות',
    description: 'TEKANGO - מערכת ניהול עסק חכמה: הפקת הצעות מחיר, ניהול לקוחות, חתימה דיגיטלית וחישוב מע"מ אוטומטי לעסקים בישראל.',
    hreflang: LANDING_HREFLANG,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'TEKANGO',
      operatingSystem: 'All',
      applicationCategory: 'BusinessApplication',
      inLanguage: 'he',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'ILS' },
      description: 'מערכת ניהול עסק חכמה להפקת הצעות מחיר, ניהול לקוחות וחישוב מע"מ אוטומטי לעסקים בישראל.',
    },
  },
  {
    path: '/en',
    page: 'landing',
    lang: 'en',
    title: 'TEKANGO - Business & Quoting SaaS Platform',
    description: 'TEKANGO is a smart business management SaaS: create quotes, manage clients, get digital signatures, and calculate totals automatically - built for businesses worldwide.',
    hreflang: LANDING_HREFLANG,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'TEKANGO',
      operatingSystem: 'All',
      applicationCategory: 'BusinessApplication',
      inLanguage: 'en',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: 'A smart business management SaaS: create quotes, manage clients, get digital signatures, and calculate totals automatically - built for businesses worldwide.',
    },
  },
  {
    path: '/he/tools',
    page: 'tools',
    lang: 'he',
    title: 'TEKANGO - מרכז הכלים והמחשבונים העסקיים',
    description: 'מחשבון המרת מטבעות, יחידות מידה, מתכות וקריפטו - כלים עסקיים חינמיים ומדויקים מבית TEKANGO.',
    hreflang: pair('/tools'),
  },
  {
    path: '/en/tools',
    page: 'tools',
    lang: 'en',
    title: 'TEKANGO - Business Tools & Calculators Hub',
    description: 'Free currency converter, unit converter, metals and crypto calculators - accurate business tools from TEKANGO.',
    hreflang: pair('/tools'),
  },
  {
    path: '/he/contact',
    page: 'contact',
    lang: 'he',
    title: 'TEKANGO - צור קשר ותמיכה',
    description: 'צרו קשר עם צוות התמיכה של TEKANGO לכל שאלה בנוגע לניהול העסק והצעות המחיר שלכם.',
    hreflang: pair('/contact'),
  },
  {
    path: '/en/contact',
    page: 'contact',
    lang: 'en',
    title: 'TEKANGO - Contact Us & Support',
    description: 'Get in touch with the TEKANGO support team for any question about managing your business and quotes.',
    hreflang: pair('/contact'),
  },
  {
    path: '/he/privacy',
    page: 'privacy',
    lang: 'he',
    title: 'TEKANGO - מדיניות פרטיות',
    description: 'מדיניות הפרטיות המלאה של פלטפורמת TEKANGO ואופן השימוש בנתוני המשתמשים.',
    hreflang: pair('/privacy'),
  },
  {
    path: '/en/privacy',
    page: 'privacy',
    lang: 'en',
    title: 'TEKANGO - Privacy Policy',
    description: 'Full Privacy Policy for the TEKANGO platform and how user data is handled.',
    hreflang: pair('/privacy'),
  },
  {
    path: '/he/terms',
    page: 'terms',
    lang: 'he',
    title: 'TEKANGO - תנאי שימוש',
    description: 'תנאי השימוש המלאים של פלטפורמת TEKANGO לניהול עסק והפקת הצעות מחיר.',
    hreflang: pair('/terms'),
  },
  {
    path: '/en/terms',
    page: 'terms',
    lang: 'en',
    title: 'TEKANGO - Terms of Service',
    description: 'Full Terms of Service for the TEKANGO business management and quoting platform.',
    hreflang: pair('/terms'),
  },
];

const BY_PATH = new Map(PUBLIC_SEO_ROUTES.map((r) => [r.path, r]));

// The setSeoMeta() arguments of one public route (canonical = the route itself). Throws on an unknown route so a page can never
// silently fall back to another page's metadata.
export function publicSeo(path) {
  const route = BY_PATH.get(path);
  if (!route) throw new Error(`publicSeo: ${path} is not a registered public SEO route`);
  const { title, description, lang, hreflang, structuredData } = route;
  return { title, description, lang, hreflang, structuredData, canonicalPath: route.path };
}

// Page kind + locale -> its canonical public route (e.g. the /contact alias renders the same page as /he/contact).
export function publicSeoFor(page, lang) {
  const route = PUBLIC_SEO_ROUTES.find((r) => r.page === page && r.lang === lang);
  if (!route) throw new Error(`publicSeoFor: no public SEO route for ${page}/${lang}`);
  return publicSeo(route.path);
}
