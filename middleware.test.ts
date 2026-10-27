import { describe, it, expect, vi, beforeEach } from 'vitest';
const geo = vi.hoisted(() => ({ country: undefined as string | undefined }));
vi.mock('@vercel/functions', () => ({ geolocation: () => ({ country: geo.country }) }));

import middleware, { resolveCanonicalRedirect, VERCEL_APP_HOST, CANONICAL_ORIGIN, resolveRootLocale, rootLocaleRedirectTarget, readCookie, LOCALE_PREF_COOKIE } from './middleware';

// חוק ברזל (Vercel Canonical Root Redirect Repair): בודק את פונקציית-ההחלטה
// הטהורה בלבד (host/pathname/search -> יעד-הפניה או null) - לא את geolocation()
// עצמה, שדורשת runtime אמיתי של Vercel Edge ואינה ניתנת להרצה תחת Vitest.

describe('resolveCanonicalRedirect', () => {
  it('canonical Production host root: NO redirect', () => {
    expect(resolveCanonicalRedirect('www.tekango.com', '/', '')).toBeNull();
  });

  it('canonical Production host, any path: NO redirect', () => {
    expect(resolveCanonicalRedirect('www.tekango.com', '/dashboard', '?lang=he')).toBeNull();
  });

  // TEKANGO Public-Migration RC (Worker 3, 2026-09-07): the business
  // requirement flipped from the prior task's decision. Previously
  // www.quotecodepro.com was deliberately left as a non-redirecting legacy
  // host (see git history for the old version of this test). Now old
  // bookmarks/links to quotecodepro.com (bare) and www.quotecodepro.com must
  // ALSO permanently 308-redirect to the equivalent path+query under
  // CANONICAL_ORIGIN, exactly like the Vercel host - they no longer continue
  // to resolve on the old site at all.
  it('legacy host (quotecodepro.com, bare apex) root: redirects to the canonical origin root', () => {
    expect(resolveCanonicalRedirect('quotecodepro.com', '/', '')).toBe(`${CANONICAL_ORIGIN}/`);
  });

  it('legacy host (quotecodepro.com, bare apex) with path and query: preserves both exactly', () => {
    expect(resolveCanonicalRedirect('quotecodepro.com', '/en/public-quote/abc123', '?lang=en')).toBe(
      `${CANONICAL_ORIGIN}/en/public-quote/abc123?lang=en`
    );
  });

  it('legacy host (www.quotecodepro.com) root: redirects to the canonical origin root', () => {
    expect(resolveCanonicalRedirect('www.quotecodepro.com', '/', '')).toBe(`${CANONICAL_ORIGIN}/`);
  });

  it('legacy host (www.quotecodepro.com) with path and query: preserves both exactly', () => {
    expect(resolveCanonicalRedirect('www.quotecodepro.com', '/dashboard', '?lang=he')).toBe(
      `${CANONICAL_ORIGIN}/dashboard?lang=he`
    );
  });

  it('Vercel host root: redirects to the canonical origin root', () => {
    expect(resolveCanonicalRedirect(VERCEL_APP_HOST, '/', '')).toBe(`${CANONICAL_ORIGIN}/`);
  });

  it('Vercel host with a path: redirects preserving the path', () => {
    expect(resolveCanonicalRedirect(VERCEL_APP_HOST, '/en', '')).toBe(`${CANONICAL_ORIGIN}/en`);
  });

  it('Vercel host with path and query: preserves both exactly', () => {
    expect(resolveCanonicalRedirect(VERCEL_APP_HOST, '/dashboard', '?lang=he')).toBe(
      `${CANONICAL_ORIGIN}/dashboard?lang=he`
    );
  });

  it('is case-insensitive on the host header (Vercel host)', () => {
    expect(resolveCanonicalRedirect('QuoteCode.Vercel.App', '/', '')).toBe(`${CANONICAL_ORIGIN}/`);
  });

  it('is case-insensitive on the host header (bare apex legacy host)', () => {
    expect(resolveCanonicalRedirect('QuoteCodePro.COM', '/dashboard', '?lang=he')).toBe(
      `${CANONICAL_ORIGIN}/dashboard?lang=he`
    );
  });

  it('is case-insensitive on the host header (www legacy host)', () => {
    expect(resolveCanonicalRedirect('WWW.QuoteCodePro.com', '/en', '?lang=en')).toBe(
      `${CANONICAL_ORIGIN}/en?lang=en`
    );
  });

  it('local development host: NO forced Production redirect', () => {
    expect(resolveCanonicalRedirect('localhost:5183', '/', '')).toBeNull();
    expect(resolveCanonicalRedirect('localhost:5186', '/', '')).toBeNull();
  });

  it('TEST/local-network host: NO forced Production redirect', () => {
    expect(resolveCanonicalRedirect('127.0.0.1:5186', '/', '')).toBeNull();
  });

  it('unknown/preview host: preserves existing behavior (no forced redirect) unless explicitly canonicalized', () => {
    expect(resolveCanonicalRedirect('quotecode-git-feature-branch.vercel.app', '/', '')).toBeNull();
    expect(resolveCanonicalRedirect('some-other-app.example.com', '/', '')).toBeNull();
  });

  it('never redirects the canonical host to itself (no loop possible by construction)', () => {
    const target = resolveCanonicalRedirect('www.tekango.com', '/', '');
    expect(target).toBeNull();
    // Even if it somehow returned a target, CANONICAL_ORIGIN never equals VERCEL_APP_HOST,
    // so a redirect can never point back to the same host that triggered it.
    expect(CANONICAL_ORIGIN).not.toContain(VERCEL_APP_HOST);
  });

  it('empty/missing host header: NO forced redirect (fails safe, does not crash)', () => {
    expect(resolveCanonicalRedirect('', '/', '')).toBeNull();
  });
});

// Google indexing root-canonical remediation (2026-09-28, locked policy TEKANGO_AI_ARCHITECTURE.md §55.11): "/" is resolved
// server-side to exactly /he or /en BEFORE any landing paints, so it can never be an indexable duplicate of /en or /he again.
describe('resolveRootLocale - precedence = main.jsx client precedence', () => {
  it('1. explicit ?lang= wins over everything', () => {
    expect(resolveRootLocale({ search: '?lang=en', cookieHeader: 'proflow_lang=he', country: 'IL', acceptLanguage: 'he-IL' })).toBe('en');
    expect(resolveRootLocale({ search: '?lang=he', cookieHeader: 'proflow_lang=en', country: 'US', acceptLanguage: 'en-US' })).toBe('he');
  });
  it('2. the saved public UI preference cookie wins over geo', () => {
    expect(resolveRootLocale({ search: '', cookieHeader: 'a=1; proflow_lang=en; b=2', country: 'IL' })).toBe('en');
    expect(resolveRootLocale({ search: '', cookieHeader: 'proflow_lang=he', country: 'US' })).toBe('he');
  });
  it('3. geo/IP: IL -> he, any other country -> en', () => {
    expect(resolveRootLocale({ search: '', country: 'IL' })).toBe('he');
    expect(resolveRootLocale({ search: '', country: 'il' })).toBe('he');
    for (const c of ['US', 'GB', 'DE', 'FR', 'PS', 'CY']) expect(resolveRootLocale({ search: '', country: c })).toBe('en');
  });
  it('4. geo unavailable: primary Accept-Language he / iw -> he', () => {
    expect(resolveRootLocale({ search: '', acceptLanguage: 'he-IL,he;q=0.9,en;q=0.8' })).toBe('he');
    expect(resolveRootLocale({ search: '', acceptLanguage: 'iw' })).toBe('he');
    expect(resolveRootLocale({ search: '', acceptLanguage: 'en-US,he;q=0.9' })).toBe('en');
  });
  it('5. nothing usable -> en (deterministic)', () => {
    expect(resolveRootLocale({ search: '' })).toBe('en');
    expect(resolveRootLocale({ search: '?lang=xx', cookieHeader: 'proflow_lang=fr; other=he', country: '', acceptLanguage: '' })).toBe('en');
  });
  it('invalid values are ignored, never trusted', () => {
    expect(resolveRootLocale({ search: '?lang=HE', cookieHeader: 'proflow_lang=Local', country: 'US' })).toBe('en');
    expect(readCookie('xproflow_lang=he; proflow_lang=en', LOCALE_PREF_COOKIE)).toBe('en');
    expect(readCookie('proflow_lang=%E0%A4%A', LOCALE_PREF_COOKIE)).toBeNull();
  });
});

describe('rootLocaleRedirectTarget', () => {
  it('always /he or /en on the same origin - never "/" (no loop) - query kept verbatim', () => {
    expect(rootLocaleRedirectTarget('https://www.tekango.com', 'he', '')).toBe('https://www.tekango.com/he');
    expect(rootLocaleRedirectTarget('https://www.tekango.com', 'en', '?code=abc&lang=en')).toBe('https://www.tekango.com/en?code=abc&lang=en');
    expect(rootLocaleRedirectTarget('https://tekango-git-x.vercel.app', 'en', '')).toBe('https://tekango-git-x.vercel.app/en');
  });
});

describe('middleware default export (root only; matcher ["/"])', () => {
  beforeEach(() => { geo.country = undefined; });
  const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

  it('canonical host, Israeli visitor: 302 to /he, not cacheable, geo cookie still written', () => {
    geo.country = 'IL';
    const res = middleware(req('https://www.tekango.com/', { host: 'www.tekango.com' }));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://www.tekango.com/he');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('vary')).toMatch(/Cookie/);
    expect(res.headers.get('set-cookie')).toMatch(/^proflow_geo_country=IL;/);
  });

  it('canonical host, returning visitor who chose English in Israel: 302 to /en (preference honored)', () => {
    geo.country = 'IL';
    const res = middleware(req('https://www.tekango.com/?utm_source=x', { host: 'www.tekango.com', cookie: 'proflow_lang=en' }));
    expect(res.headers.get('location')).toBe('https://www.tekango.com/en?utm_source=x');
  });

  it('geo unavailable, no preference, no Accept-Language: 302 to /en and no geo cookie', () => {
    const res = middleware(req('https://www.tekango.com/', { host: 'www.tekango.com' }));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://www.tekango.com/en');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('Auth callback query on "/" is carried to the locale route unchanged', () => {
    geo.country = 'US';
    const res = middleware(req('https://www.tekango.com/?error=access_denied&error_code=otp_expired', { host: 'www.tekango.com' }));
    expect(res.headers.get('location')).toBe('https://www.tekango.com/en?error=access_denied&error_code=otp_expired');
  });

  it('legacy hosts still 308 to the canonical origin FIRST (unchanged), before any locale logic', () => {
    geo.country = 'IL';
    for (const host of ['quotecode.vercel.app', 'quotecodepro.com', 'www.quotecodepro.com']) {
      const res = middleware(req(`https://${host}/?lang=he`, { host }));
      expect(res.status).toBe(308);
      expect(res.headers.get('location')).toBe('https://www.tekango.com/?lang=he');
    }
  });

  it('the matcher still covers the root only', async () => {
    const mod = await import('./middleware');
    expect(mod.config).toEqual({ matcher: ['/'] });
  });
});
